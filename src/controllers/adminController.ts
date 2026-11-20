import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { supabase, supabaseAdmin, rawSupabaseAdmin, isSupabaseConfigured } from "../config/supabase";
import { logAdminAction } from "./masterController";
import { getJwtSecret } from "../utils/jwtSecret";

const db = () => rawSupabaseAdmin || supabaseAdmin;

/**
 * POST /api/admin/login
 * Administrative Authentication backed by Supabase Auth + public.user_role_assignments
 */
export const adminLogin = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Database service unavailable. Supabase is not configured." });
  }

  const jwtSecret = getJwtSecret();

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const rawPassword = String(password);

  try {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword,
    });

    if (authErr || !authData?.user) {
      await logAdminAction({
        actorUserId: null,
        actorRole: "admin",
        actionKey: "ADMIN_LOGIN_FAILED",
        targetEntityType: "admin_portal",
        description: `Failed admin login attempt for ${normalizedEmail}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: authErr?.message || "Invalid credentials",
      });

      return res.status(401).json({
        error: "Invalid administrative credentials. Access restricted to authorized PAYTUNE personnel.",
      });
    }

    const client = db();
    const userId = authData.user.id;

    // Verify user has an active admin or master_admin assignment in PostgreSQL
    const { data: roleRows, error: roleErr } = await client
      .from("user_role_assignments")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("role", ["admin", "master_admin"]);

    if (roleErr) {
      throw roleErr;
    }

    const activeRoles = (roleRows || []).map((r: any) => String(r.role));
    if (activeRoles.length === 0) {
      await logAdminAction({
        actorUserId: userId,
        actorRole: "user",
        actionKey: "ADMIN_LOGIN_DENIED",
        targetEntityType: "admin_portal",
        targetUserId: userId,
        description: `User ${normalizedEmail} lacks admin/master_admin role assignment.`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "Missing administrative role assignment",
      });

      return res.status(403).json({
        error: "Access denied. This account does not have administrative privileges.",
      });
    }

    const isMaster = activeRoles.includes("master_admin");
    const assignedRole = isMaster ? "master_admin" : "admin";

    const { data: profile } = await client
      .from("profiles")
      .select("user_id, username, display_name, avatar_storage_path, account_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.account_status && ["suspended", "closed"].includes(profile.account_status)) {
      return res.status(403).json({
        error: "This administrative account has been suspended or closed.",
      });
    }

    const token = jwt.sign(
      {
        id: userId,
        sub: userId,
        userId,
        email: authData.user.email || normalizedEmail,
        role: assignedRole,
        is_master: isMaster,
        user_metadata: {
          ...(authData.user.user_metadata || {}),
          role: assignedRole,
          is_master: isMaster,
        },
      },
      jwtSecret,
      { expiresIn: "12h" }
    );

    const adminProfile = {
      id: userId,
      email: authData.user.email || normalizedEmail,
      full_name: profile?.display_name || authData.user.user_metadata?.full_name || "PAYTUNE Administrator",
      username: profile?.username || normalizedEmail.split("@")[0],
      avatar_url: profile?.avatar_storage_path || null,
      role: isMaster ? "MASTER_ADMIN" : "ADMIN",
      db_role: assignedRole,
      is_master: isMaster,
    };

    await logAdminAction({
      actorUserId: userId,
      actorRole: assignedRole,
      actionKey: "ADMIN_LOGIN_SUCCESS",
      targetEntityType: "admin_portal",
      targetUserId: userId,
      description: `Administrator ${adminProfile.email} signed in (${assignedRole}).`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
    });

    return res.json({
      message: "Administrative clearance authorized",
      token,
      admin: adminProfile,
      redirect_url: "/master/dashboard",
    });
  } catch (err: any) {
    console.error("[ADMIN-LOGIN] Error:", err);
    return res.status(500).json({ error: err?.message || "Administrative login failed." });
  }
};

/**
 * GET /api/admin/me
 */
export const getAdminMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: "Administrative authentication required." });
  }

  try {
    const client = db();
    const { data: roleRows, error: roleErr } = await client
      .from("user_role_assignments")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["admin", "master_admin"]);

    if (roleErr) throw roleErr;
    const roles = (roleRows || []).map((r: any) => String(r.role));
    if (roles.length === 0) {
      return res.status(403).json({ error: "Administrative role not active." });
    }

    const { data: profile } = await client
      .from("profiles")
      .select("user_id, username, display_name, avatar_storage_path")
      .eq("user_id", user.id)
      .maybeSingle();

    const isMaster = roles.includes("master_admin");

    return res.json({
      id: user.id,
      email: user.email,
      full_name: profile?.display_name || user.user_metadata?.full_name || "PAYTUNE Administrator",
      username: profile?.username || null,
      avatar_url: profile?.avatar_storage_path || null,
      role: isMaster ? "MASTER_ADMIN" : "ADMIN",
      db_role: isMaster ? "master_admin" : "admin",
      is_master: isMaster,
    });
  } catch (err: any) {
    console.error("[ADMIN-ME] Error:", err);
    return res.status(500).json({ error: err?.message || "Failed to load administrator profile." });
  }
};
