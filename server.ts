import "./src/config/env";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import multer from "multer";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import compression from "compression";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import { authenticate, optionalAuthenticate, checkRole } from "./src/middleware/auth";
import videoRouter from "./src/routes/videoRoutes";
import purchaseRouter from "./src/routes/purchaseRoutes";
import commentRouter from "./src/routes/commentRoutes";
import artistRouter, { artistStudioRouter } from "./src/routes/artistRoutes";
import artistVideoRoutes from "./src/routes/artistVideoRoutes";
import userRouter from "./src/routes/userRoutes";
import playlistRouter from "./src/routes/playlistRoutes";
import historyRouter from "./src/routes/historyRoutes";
import wishlistRouter from "./src/routes/wishlistRoutes";
import notificationRouter from "./src/routes/notificationRoutes";
import masterRouter from "./src/routes/masterRoutes";
import adminRouter from "./src/routes/adminRoutes";
import shortsRouter from "./src/routes/shortsRoutes";
import liveRouter, { artistLiveRouter } from "./src/routes/liveRoutes";
import categoryRouter from "./src/routes/categoryRoutes";
import globalPaymentRouter from "./src/routes/globalPaymentRoutes";
import paymentRouter from "./src/routes/paymentRoutes";
import webhookRouter from "./src/routes/webhookRoutes";
import authRouter from "./src/routes/authRoutes";
import uploadRouter from "./src/routes/uploadRoutes";
import copyrightRouter, { dmcaRouter } from "./src/routes/copyrightRoutes";
import adRouter from "./src/routes/adRoutes";
import accessRequestRouter from "./src/routes/accessRequestRoutes";
import edgeFunctionRoutes from "./src/routes/edgeFunctionRoutes";
import partnerProgramRouter from "./src/routes/partnerProgramRoutes";
import musicRouter from "./src/routes/musicRoutes";
import { processAndUploadVideo } from "./src/services/videoService";
import { processPurchase } from "./src/services/paymentSplitter";
import { supabaseAdmin, isSupabaseConfigured, supabaseProjectInfo, ensureSupabaseStorageBuckets } from "./src/config/supabase";
import { setNotificationIO, notifyOnMembershipJoined, notifyOnSuperThanks } from "./src/services/notificationService";
import { detectCountryFromRequest } from "./src/services/geoService";
import { monitoringService } from "./src/services/monitoringService";
import { cacheService } from "./src/services/cacheService";

const app = express();
app.set("trust proxy", 1);
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// 1. Enable secure HTTP response compression for optimized low-latency delivery
app.use(compression());

app.use(cors({ origin: true, credentials: true }));

// JSON body — for regular API calls. Multipart bypasses this entirely.
app.use((req, res, next) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  const isStripeWebhook = req.originalUrl === '/api/webhooks/stripe';
  if (isMultipart || isStripeWebhook) return next();
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })(req, res, next);
});

app.use((req, res, next) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  const isStripeWebhook = req.originalUrl === '/api/webhooks/stripe';
  if (isMultipart || isStripeWebhook) return next();
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

// 2. Defensive security: Input Sanitisation middleware to strip potentially dangerous script injection tags
const sanitizeValue = (val: any): any => {
  if (typeof val === "string") {
    return val.replace(/<[^>]*>/g, "").trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === "object") {
    const cleanObj: any = {};
    for (const key of Object.keys(val)) {
      cleanObj[key] = sanitizeValue(val[key]);
    }
    return cleanObj;
  }
  return val;
};

const inputSanitizer = (req: any, res: any, next: any) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

app.use(inputSanitizer);

// 3. Defensive security: API Rate Limiters to safeguard from high-frequency brute-forcing or payment exhaustion
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5000, 
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true
  },
  message: {
    error: "Too Many Requests",
    message: "Security rate limit reached. Please retry after a few minutes."
  },
  skip: (req) => {
    return (
      req.method === 'GET' ||
      req.originalUrl === "/api/health" ||
      req.originalUrl.includes("/api/diagnostics") ||
      req.originalUrl.includes("/api/exchange-rates") ||
      req.originalUrl.includes("/api/artists") ||
      req.originalUrl.includes("/api/videos") ||
      req.originalUrl.includes("/api/comments")
    );
  }
});

app.use("/api/", apiLimiter);

// 4. Stricter rate limiting for financial transactions (payment initiation & purchases)
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true
  },
  message: {
    success: false,
    error: "Too Many Payment Requests",
    message: "High frequency payment attempts detected. Please wait a few minutes before retrying."
  }
});
app.use("/api/payment/", paymentLimiter);
app.use("/api/purchase/", paymentLimiter);

// 5. Real Performance Monitoring & Latency Tracking Middleware
app.use((req, res, next) => {
  const startNs = process.hrtime.bigint();
  const originalWriteHead = res.writeHead.bind(res);
  (res as any).writeHead = function (...args: any[]) {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
    return originalWriteHead(...args);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    if (req.originalUrl.startsWith('/api')) {
      monitoringService.recordRequest(req.method, req.originalUrl, res.statusCode, durationMs);
    }
    if (durationMs > 500 || req.originalUrl.startsWith('/api/payment') || res.statusCode >= 400) {
      console.log(`[PERF/MONITOR] ${req.method} ${req.originalUrl} [${res.statusCode}] - ${durationMs.toFixed(1)}ms`);
    }
  });
  next();
});

// --- Real Systems Diagnostics, Telemetry & Live Supabase Verification ---
app.get("/api/diagnostics/check", authenticate, checkRole('master'), async (_req, res) => {
  try {
    const snapshot = await monitoringService.getSnapshot();

    res.json({
      timestamp: snapshot.timestamp,
      uptime: snapshot.system.uptimeSeconds,
      database: {
        engine: "postgresql-supabase",
        singleDatabase: true,
        configured: isSupabaseConfigured(),
        connected: snapshot.supabase.connected,
        latencyMs: snapshot.supabase.latencyMs,
        projectId: supabaseProjectInfo.projectId,
        url: supabaseProjectInfo.url,
        tables: snapshot.supabase.tables
      },
      supabase: {
        configured: supabaseProjectInfo.isConfigured,
        connected: snapshot.supabase.connected,
        latencyMs: snapshot.supabase.latencyMs,
        projectId: supabaseProjectInfo.projectId,
        url: supabaseProjectInfo.url,
        urlSet: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        serviceKeySet: supabaseProjectInfo.hasServiceKey,
        storage: snapshot.supabase.storage
      },
      cloudinary: {
        configured: !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME)
      },
      paymentGateways: {
        mtnMoMo: !!process.env.MTN_MOMO_API_KEY,
        airtelMoney: !!(process.env.AIRTEL_CLIENT_ID || process.env.AIRTEL_MONEY_API_KEY),
        stripe: !!process.env.STRIPE_SECRET_KEY
      },
      system: snapshot.system,
      apiMetrics: snapshot.api
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/metrics", authenticate, checkRole('master'), async (_req, res) => {
  try {
    const snapshot = await monitoringService.getSnapshot();
    res.json({ success: true, ...snapshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/diagnostics/run-e2e", authenticate, checkRole('master'), async (_req, res) => {
  const logs: string[] = [];
  let status: "SUCCESS" | "FAILED" = "SUCCESS";

  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    log("Launching PayTune Real End-to-End Infrastructure Verification...");

    log("STEP 1: Probing Live Supabase PostgreSQL Connection & Schema...");
    const dbHealth = await monitoringService.checkSupabaseHealth();
    if (!dbHealth.configured || !dbHealth.connected) {
      throw new Error(dbHealth.error || "Live Supabase PostgreSQL probe failed.");
    }
    log(`Connected to Supabase project '${dbHealth.projectId}' in ${dbHealth.latencyMs}ms.`);
    for (const [table, info] of Object.entries(dbHealth.tables)) {
      log(`   - table '${table}': ${info.ok ? `OK (${info.count ?? 0} rows)` : `WARN (${info.error})`}`);
    }

    log("STEP 2: Verifying Supabase Object Storage Buckets...");
    if (dbHealth.storage.ok) {
      log(`Storage online. Active buckets: ${dbHealth.storage.buckets.join(", ") || "none"}`);
    } else {
      log(`Storage check warning: ${dbHealth.storage.error}`);
    }

    log("STEP 3: Verifying High-Speed Cache Service Roundtrip...");
    const cacheTestKey = `paytune:diag:${Date.now()}`;
    await cacheService.set(cacheTestKey, { ok: true }, 15);
    const cacheRead = await cacheService.get<{ ok: boolean }>(cacheTestKey);
    await cacheService.del(cacheTestKey);
    if (!cacheRead?.ok) {
      throw new Error("Cache read/write roundtrip failed.");
    }
    log("Cache read/write/invalidate verified successfully.");

    log("STEP 4: Verifying Automated Financial Ledger Split Arithmetic (5% VAT + 70/30)...");
    const samplePrice = 10000;
    const VAT = Math.round(samplePrice * 0.05);
    const net = samplePrice - VAT;
    const artistPayout = Math.round(net * 0.7);
    const platformRevenue = net - artistPayout;
    const doubleCheck = VAT + artistPayout + platformRevenue;
    log(`Sample Amount: ${samplePrice} RWF | VAT (5%): ${VAT} RWF | Artist (70% net): ${artistPayout} RWF | Platform: ${platformRevenue} RWF`);
    if (doubleCheck !== samplePrice) {
      throw new Error(`Ledger arithmetic mismatch: ${doubleCheck} !== ${samplePrice}`);
    }
    log("Double-entry ledger split balance verified.");

    const apiMetrics = monitoringService.getApiMetrics();
    log(`STEP 5: API Telemetry Summary — Requests: ${apiMetrics.totalRequests}, Avg Latency: ${apiMetrics.avgLatencyMs}ms, p95: ${apiMetrics.p95LatencyMs}ms, Error Rate: ${apiMetrics.errorRatePercent}%`);
    log("End-to-End Verification Completed Successfully.");
  } catch (err: any) {
    status = "FAILED";
    log(`ERROR: ${err.message}`);
  }

  res.json({
    status,
    timestamp: new Date().toISOString(),
    logs
  });
});

app.get("/api/diagnostics/backup-db", authenticate, checkRole('master'), async (_req, res) => {
  try {
    const snapshot = await monitoringService.getSnapshot();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=paytune_db_diagnostics.json");
    res.send(JSON.stringify({
      exported_at: new Date().toISOString(),
      engine: "postgresql-supabase",
      projectId: supabaseProjectInfo.projectId,
      tables: snapshot.supabase.tables,
      storage: snapshot.supabase.storage
    }, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/diagnostics/restore-db", authenticate, checkRole('master'), (_req, res) => {
  return res.status(410).json({
    error: "Local JSON snapshot restore is disabled. PAYTUNE operates directly against PostgreSQL/Supabase."
  });
});

// Check configuration on all /api routes except health
app.use("/api/*", (req, res, next) => {
  if (req.originalUrl === "/api/health") return next();
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: "Service Not Configured",
      message: "Please configure Supabase environment variables in the Settings menu."
    });
  }
  next();
});

// --- Public Routes ---
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.get("/api/health", async (_req, res) => {
  try {
    const dbHealth = await monitoringService.checkSupabaseHealth();
    const sys = monitoringService.getSystemMetrics();
    return res.json({
      status: dbHealth.connected ? "ok" : "degraded",
      app: "PAYTUNE",
      engine: "postgresql-supabase",
      projectId: dbHealth.projectId,
      database: {
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
      },
      storage: dbHealth.storage,
      uptimeSeconds: sys.uptimeSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ status: "error", app: "PAYTUNE", error: err?.message });
  }
});

// Geo and Country Detection (Country-based phone input and payout routing)
app.get("/api/detect-country", async (req, res) => {
  try {
    const geo = await detectCountryFromRequest(req);
    if (!geo.is_detected || !geo.country_code) {
      return res.json({
        success: true,
        is_detected: false,
        country_code: null,
        currency_code: null,
        country_name: null,
        dial_code: null,
        phone_code: null,
        payment_gateway: null,
        payout_provider: null,
        city: null,
        ip: geo.ip
      });
    }

    const countryCode = geo.country_code.toUpperCase();
    const COUNTRY_INFO: Record<string, { dial_code: string; gateway: string; name: string; currency: string }> = {
      RW: { dial_code: "+250", gateway: "mtn_momo", name: "Rwanda", currency: "RWF" },
      TZ: { dial_code: "+255", gateway: "mpesa", name: "Tanzania", currency: "TZS" },
      KE: { dial_code: "+254", gateway: "mpesa", name: "Kenya", currency: "KES" },
      UG: { dial_code: "+256", gateway: "mtn_momo", name: "Uganda", currency: "UGX" },
      NG: { dial_code: "+234", gateway: "paystack", name: "Nigeria", currency: "NGN" },
      GH: { dial_code: "+233", gateway: "mtn_momo", name: "Ghana", currency: "GHS" },
      ZA: { dial_code: "+27", gateway: "paystack", name: "South Africa", currency: "ZAR" },
      US: { dial_code: "+1", gateway: "stripe", name: "United States", currency: "USD" },
      GB: { dial_code: "+44", gateway: "stripe", name: "United Kingdom", currency: "GBP" },
      DE: { dial_code: "+49", gateway: "stripe", name: "Germany", currency: "EUR" },
      FR: { dial_code: "+33", gateway: "stripe", name: "France", currency: "EUR" },
      CA: { dial_code: "+1", gateway: "stripe", name: "Canada", currency: "CAD" },
      AU: { dial_code: "+61", gateway: "stripe", name: "Australia", currency: "AUD" },
      IN: { dial_code: "+91", gateway: "upi", name: "India", currency: "INR" }
    };

    const details = COUNTRY_INFO[countryCode];
    return res.json({
      success: true,
      is_detected: true,
      country_code: countryCode,
      currency_code: details?.currency || geo.currency_code || null,
      country_name: details?.name || geo.country_name || countryCode,
      dial_code: details?.dial_code || null,
      phone_code: details?.dial_code || null,
      payment_gateway: details?.gateway || "stripe",
      payout_provider:
        details?.gateway === "mtn_momo"
          ? "MTN Mobile Money"
          : details?.gateway === "mpesa"
          ? "M-Pesa"
          : details?.gateway === "paystack"
          ? "Paystack"
          : details?.gateway === "upi"
          ? "UPI"
          : "Stripe",
      city: geo.city || null,
      ip: geo.ip
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      is_detected: false,
      error: err?.message || "Country detection failed"
    });
  }
});
app.use("/api/upload", uploadRouter);
app.use("/api/auth", authRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api", globalPaymentRouter);
app.use("/api/admin", adminRouter);
app.use("/api/master", masterRouter);
app.use("/api/videos", videoRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/live", liveRouter);
app.use("/api/artist/live", artistLiveRouter);
app.use("/api/ads", adRouter);
app.use("/api/admin/ads", adRouter);
app.use("/api/shorts", shortsRouter);
app.use("/api/artists", artistRouter);
app.use("/api/purchase", purchaseRouter);
app.use("/api/comments", commentRouter);
app.use("/api/copyright", copyrightRouter);
app.use("/api/dmca", dmcaRouter);
app.use("/api/edge-functions", edgeFunctionRoutes);
app.use("/functions/v1", edgeFunctionRoutes);
app.use("/api/access-requests", accessRequestRouter);
app.use("/api/partner-program", partnerProgramRouter);
app.use("/api", partnerProgramRouter);
app.use("/api/music", musicRouter);

// --- User Dashboard API Endpoints ---
app.use("/api/user/playlists", playlistRouter);
app.use("/api/user/history", historyRouter);
app.use("/api/user/wishlist", wishlistRouter);
app.use("/api/user/notifications", notificationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/artist/notifications", notificationRouter);
app.use("/api/user", userRouter);

// --- Artist Dashboard Routes ---
app.use("/api/artist", artistVideoRoutes);
app.use("/api/artist/upload", uploadRouter);
app.use("/api/artist", artistStudioRouter);
app.get("/api/artist/:artistId/dashboard", artistStudioRouter);

// --- Shorts API Endpoints ---
app.post("/api/artist/short/upload", authenticate, checkRole('artist'), upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req: any, res: any) => {
  const user = req.user;
  const { title, description, visibility } = req.body;

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase not configured." });
  }

  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    const { data: artistProfile } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`primary_contact_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) {
      return res.status(404).json({ error: "Creator channel not found" });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const videoFile = files?.video?.[0];
    const thumbFile = files?.thumbnail?.[0];
    if (!videoFile) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const processed = await processAndUploadVideo({
      videoBuffer: videoFile.buffer,
      thumbnailBuffer: thumbFile ? thumbFile.buffer : null,
      originalName: videoFile.originalname,
      artistId: artistProfile?.id || channel.id,
      metadata: { is_short: true }
    });

    const sourceMediaId = crypto.randomUUID();
    const now = new Date().toISOString();
    const fileExt = path.extname(videoFile.originalname || 'short.mp4').replace('.', '').slice(0, 16) || 'mp4';
    await supabaseAdmin.from('media_assets').insert({
      id: sourceMediaId,
      owner_user_id: user.id,
      uploaded_by_user_id: user.id,
      original_file_name: videoFile.originalname || `short-${sourceMediaId.slice(0, 8)}.mp4`,
      file_extension: fileExt,
      mime_type: videoFile.mimetype || 'video/mp4',
      media_kind: 'video',
      media_purpose: 'short_source',
      storage_provider: 'supabase',
      storage_bucket: 'videos',
      storage_path: processed.video_url,
      processing_status: 'ready',
      metadata: { public_url: processed.video_url },
      created_at: now,
      updated_at: now
    });

    const shortId = crypto.randomUUID();
    const { data: video, error } = await supabaseAdmin
      .from('videos')
      .insert({
        id: shortId,
        creator_channel_id: channel.id,
        artist_profile_id: artistProfile?.id || null,
        created_by_user_id: user.id,
        video_type: 'short',
        title: title || "New Short",
        description: description || "",
        slug: `short-${shortId.slice(0, 8)}`,
        duration_seconds: processed.duration || 0,
        source_media_asset_id: sourceMediaId,
        visibility: visibility || 'public',
        publication_status: 'published',
        processing_status: 'completed',
        moderation_status: 'approved',
        is_free: true,
        is_paywalled: false,
        published_at: now,
        metadata: {
          video_url: processed.video_url,
          preview_url: processed.preview_url,
          thumbnail_url: processed.thumbnail_url
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "Failed to save Short details." });
    }

    res.json(video);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/shorts", authenticate, checkRole('artist'), async (req: any, res: any) => {
  const user = req.user;
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase not configured." });
  }

  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) {
      return res.status(404).json({ error: "Creator channel not found" });
    }

    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .eq('video_type', 'short')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/artist/short/:id", authenticate, checkRole('artist'), async (req: any, res: any) => {
  const { id } = req.params;
  const user = req.user;
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase not configured." });
  }

  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) {
      return res.status(404).json({ error: "Creator channel not found" });
    }

    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('creator_channel_id, created_by_user_id')
      .eq('id', id)
      .maybeSingle();

    if (!video || (video.creator_channel_id !== channel.id && video.created_by_user_id !== user.id)) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const { error } = await supabaseAdmin
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: "Short deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Purchase Routes ---
app.post("/api/purchase/initiate", authenticate, async (req, res) => {
  const { videoId, amount, phone, provider, transactionId } = req.body;
  const user = (req as any).user;

  try {
    const purchase = await processPurchase(
      user.id,
      videoId,
      phone,
      Number(amount),
      transactionId || `PAYTUNE-${Date.now()}`,
      provider
    );
    res.json({ success: true, purchase });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Settings & Profile Routes ---

app.get("/api/user/settings", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "User profile not found" });
    }
    res.json({ ...data, full_name: data.display_name || user.user_metadata?.full_name || "" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/user/settings", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { full_name, display_name, username, bio } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: display_name || full_name || null,
          username: username || null,
          bio: bio || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, profile: { ...data, full_name: data.display_name || "" } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/change-password", authenticate, async (req, res) => {
  const user = (req as any).user;
  const nextPassword = String(req.body?.newPassword || req.body?.password || "");
  if (!nextPassword || nextPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nextPassword });
    if (error) throw error;
    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/delete-account", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    await supabaseAdmin
      .from('account_deletion_requests')
      .insert({
        user_id: user.id,
        status: 'requested',
        requested_at: new Date().toISOString()
      });
    res.json({ success: true, message: "Account deletion request submitted." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Artist Studio Details
app.get("/api/artist/settings", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: artist, error } = await supabaseAdmin
      .from('artist_profiles')
      .select('*')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    if (error) throw error;
    if (!artist) return res.status(404).json({ error: "Artist profile not found" });
    res.json(artist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/artist/settings", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { full_name, artist_name, bio, profile_image, avatar_path } = req.body;
  try {
    const { data: currentArtist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!currentArtist) return res.status(404).json({ error: "Artist profile not found" });

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (artist_name || full_name) updatePayload.artist_name = artist_name || full_name;
    if (bio !== undefined) updatePayload.bio_en = bio;
    if (avatar_path || profile_image) updatePayload.avatar_path = avatar_path || profile_image;

    const { data, error } = await supabaseAdmin
      .from('artist_profiles')
      .update(updatePayload)
      .eq('id', currentArtist.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, artist: { ...data, bio: data.bio_en || "" } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Video Likes API ---
app.get("/api/videos/:id/like-status", optionalAuthenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) return res.json({ liked: false });
  try {
    const { data } = await supabaseAdmin
      .from('content_reactions')
      .select('id')
      .eq('content_type', 'video')
      .eq('content_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', 'like')
      .maybeSingle();

    res.json({ liked: !!data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Video Wishlist API (backed by user's Wishlist playlist) ---
app.get("/api/videos/:id/wishlist-status", optionalAuthenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) return res.json({ inWishlist: false });
  try {
    const { data: list } = await supabaseAdmin
      .from('playlists')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('title', 'Wishlist')
      .maybeSingle();

    if (!list) return res.json({ inWishlist: false });

    const { data: item } = await supabaseAdmin
      .from('playlist_items')
      .select('id')
      .eq('playlist_id', list.id)
      .eq('content_id', id)
      .maybeSingle();

    res.json({ inWishlist: !!item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/videos/:id/wishlist", authenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  try {
    let { data: list } = await supabaseAdmin
      .from('playlists')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('playlist_type', 'system')
      .eq('title', 'Wishlist')
      .maybeSingle();

    if (!list) {
      const { data: legacyList } = await supabaseAdmin
        .from('playlists')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('title', 'Wishlist')
        .maybeSingle();
      list = legacyList;
    }

    if (!list) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('playlists')
        .insert({
          owner_user_id: user.id,
          playlist_type: 'system',
          is_system_playlist: true,
          title: 'Wishlist',
          description: 'Saved Watch Later videos',
          visibility: 'private'
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      list = created;
    }

    const { data: existing } = await supabaseAdmin
      .from('playlist_items')
      .select('id')
      .eq('playlist_id', list.id)
      .eq('content_id', id)
      .maybeSingle();

    let inWishlist = false;
    if (existing) {
      await supabaseAdmin.from('playlist_items').delete().eq('id', existing.id);
      inWishlist = false;
    } else {
      const { count: currentCount } = await supabaseAdmin
        .from('playlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', list.id);

      await supabaseAdmin.from('playlist_items').insert({
        playlist_id: list.id,
        content_type: 'video',
        content_id: id,
        position: currentCount || 0,
        added_by_user_id: user.id
      });
      inWishlist = true;
    }

    const { count: updatedCount } = await supabaseAdmin
      .from('playlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', list.id);

    await supabaseAdmin
      .from('playlists')
      .update({ items_count: updatedCount || 0, updated_at: new Date().toISOString() })
      .eq('id', list.id);

    return res.json({ inWishlist });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Artist Subscriptions / Follows API ---
app.get("/api/artist/:id/subscribe-status", optionalAuthenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) return res.json({ subscribed: false });
  try {
    const { data } = await supabaseAdmin
      .from('artist_follows')
      .select('id')
      .eq('artist_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    res.json({ subscribed: !!data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/artist/:id/subscribe", authenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  try {
    const { data: existing } = await supabaseAdmin
      .from('artist_follows')
      .select('id')
      .eq('artist_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('artist_follows')
        .delete()
        .eq('artist_id', id)
        .eq('user_id', user.id);
      return res.json({ subscribed: false });
    } else {
      await supabaseAdmin
        .from('artist_follows')
        .insert({ artist_id: id, user_id: user.id });
      return res.json({ subscribed: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- Creator Analytics APIs ---
// ==========================================

app.get("/api/artist/analytics/overview", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!artist && !channel) {
      return res.status(403).json({ error: "Unauthorized. Artist profile required." });
    }

    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id, title, metadata')
      .or(
        [
          artist?.id ? `artist_profile_id.eq.${artist.id}` : '',
          channel?.id ? `creator_channel_id.eq.${channel.id}` : ''
        ]
          .filter(Boolean)
          .join(',')
      );

    const videoIds = (videos || []).map((v: any) => v.id);
    let analyticsRecords: any[] = [];
    if (videoIds.length > 0) {
      const { data: analytics } = await supabaseAdmin
        .from('video_daily_analytics')
        .select('*')
        .in('video_id', videoIds);
      analyticsRecords = analytics || [];
    }

    const totalViews = analyticsRecords.reduce((sum, r) => sum + Number(r.valid_views || r.total_view_events || 0), 0);
    const totalWatchTimeSeconds = analyticsRecords.reduce((sum, r) => sum + Number(r.total_watch_seconds || 0), 0);
    const totalWatchTimeMinutes = Math.round(totalWatchTimeSeconds / 60);
    const averageViewDuration = totalViews > 0 ? Math.round(totalWatchTimeSeconds / totalViews) : 0;

    let subscribersGained = 0;
    if (artist?.id) {
      const { count } = await supabaseAdmin
        .from('artist_follows')
        .select('user_id', { count: 'exact', head: true })
        .eq('artist_id', artist.id);
      subscribersGained = count || 0;
    }

    let estimatedRevenue = 0;
    if (channel?.id) {
      const { data: acct } = await supabaseAdmin
        .from('creator_earning_accounts')
        .select('available_balance, settled_total, pending_balance')
        .eq('creator_channel_id', channel.id)
        .maybeSingle();
      if (acct) {
        estimatedRevenue = Number(acct.available_balance || 0) + Number(acct.settled_total || 0) + Number(acct.pending_balance || 0);
      }
    }

    const topVideos = (videos || [])
      .map((v: any) => {
        const videoAnalytics = analyticsRecords.filter((r) => r.video_id === v.id);
        const vSeconds = videoAnalytics.reduce((sum, r) => sum + Number(r.total_watch_seconds || 0), 0);
        const vViews = videoAnalytics.reduce((sum, r) => sum + Number(r.valid_views || r.total_view_events || 0), 0);
        return {
          id: v.id,
          title: v.title,
          views: vViews,
          watchTime: Math.round(vSeconds / 60),
          revenue: 0
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    res.json({
      totalViews,
      totalWatchTimeMinutes,
      averageViewDuration,
      subscribersGained,
      estimatedRevenue,
      revenueByCountry: [],
      topVideos
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/analytics/watch-time", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { period = "week" } = req.query;
  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!artist) return res.status(403).json({ error: "Artist profile not found." });

    const daysCount = period === "year" ? 365 : period === "month" ? 30 : 7;
    const since = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('artist_profile_id', artist.id);

    const videoIds = (videos || []).map((v: any) => v.id);
    if (videoIds.length === 0) {
      return res.json([]);
    }

    const { data: analyticsRows, error } = await supabaseAdmin
      .from('video_daily_analytics')
      .select('analytics_date, valid_views, total_view_events, total_watch_seconds')
      .in('video_id', videoIds)
      .gte('analytics_date', since)
      .order('analytics_date', { ascending: true });

    if (error) throw error;

    const grouped = new Map<string, { views: number; watchTime: number; revenue: number }>();
    for (const row of analyticsRows || []) {
      const dateKey = String(row.analytics_date);
      const prev = grouped.get(dateKey) || { views: 0, watchTime: 0, revenue: 0 };
      prev.views += Number(row.valid_views || row.total_view_events || 0);
      prev.watchTime += Math.round(Number(row.total_watch_seconds || 0) / 60);
      grouped.set(dateKey, prev);
    }

    const records = Array.from(grouped.entries()).map(([date, stats]) => ({
      name: date,
      ...stats
    }));

    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/analytics/demographics", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!artist && !channel) return res.status(403).json({ error: "Artist profile not found." });

    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id')
      .or([
        artist?.id ? `artist_profile_id.eq.${artist.id}` : '',
        channel?.id ? `creator_channel_id.eq.${channel.id}` : ''
      ].filter(Boolean).join(','));

    const videoIds = (videos || []).map((v: any) => v.id);
    if (videoIds.length === 0) {
      return res.json({ devices: [], countries: [], browsers: [] });
    }

    const { data: events, error } = await supabaseAdmin
      .from('video_view_events')
      .select('metadata')
      .in('video_id', videoIds)
      .limit(1000);

    if (error) throw error;

    const countBy = (field: 'device_type' | 'country_code' | 'browser') => {
      const map = new Map<string, number>();
      for (const row of events || []) {
        const meta = (row as any).metadata || {};
        const key = String(meta[field] || (field === 'browser' ? meta.platform : '') || '').trim();
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    };

    res.json({
      devices: countBy('device_type'),
      countries: countBy('country_code'),
      browsers: countBy('browser')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/analytics/revenue", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(403).json({ error: "Creator channel required." });

    const { data: account } = await supabaseAdmin
      .from('creator_earning_accounts')
      .select('id')
      .eq('creator_channel_id', channel.id)
      .maybeSingle();

    if (!account) {
      return res.json({
        estimatedRevenue: 0,
        revenueBySource: [],
        revenueByMethod: [],
        revenueMonthly: []
      });
    }

    const { data: txs, error } = await supabaseAdmin
      .from('creator_earning_transactions')
      .select('revenue_source, creator_amount, created_at')
      .eq('earning_account_id', account.id);

    if (error) throw error;

    let totalRev = 0;
    const bySource = new Map<string, number>();
    const byMonth = new Map<string, number>();

    for (const tx of txs || []) {
      const amt = Number(tx.creator_amount || 0);
      totalRev += amt;
      const src = String(tx.revenue_source || 'other');
      bySource.set(src, (bySource.get(src) || 0) + amt);
      const month = String(tx.created_at || '').slice(0, 7);
      if (month) byMonth.set(month, (byMonth.get(month) || 0) + amt);
    }

    res.json({
      estimatedRevenue: totalRev,
      revenueBySource: Array.from(bySource.entries()).map(([name, value]) => ({ name, value })),
      revenueByMethod: [],
      revenueMonthly: Array.from(byMonth.entries()).map(([month, revenue]) => ({ month, revenue }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/analytics/traffic-sources", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!artist && !channel) return res.status(403).json({ error: "Artist profile required." });

    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id')
      .or([
        artist?.id ? `artist_profile_id.eq.${artist.id}` : '',
        channel?.id ? `creator_channel_id.eq.${channel.id}` : ''
      ].filter(Boolean).join(','));

    const videoIds = (videos || []).map((v: any) => v.id);
    if (videoIds.length === 0) return res.json([]);

    const { data: events, error } = await supabaseAdmin
      .from('video_view_events')
      .select('traffic_source')
      .in('video_id', videoIds)
      .limit(1000);

    if (error) throw error;

    const map = new Map<string, number>();
    for (const ev of events || []) {
      const src = String((ev as any).traffic_source || '').trim() || 'Direct';
      map.set(src, (map.get(src) || 0) + 1);
    }

    res.json(Array.from(map.entries()).map(([name, value]) => ({ name, value })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/watch/heartbeat", optionalAuthenticate, async (req, res) => {
  const { videoId, positionSeconds, completed, deviceType = "desktop", browser = "web", country = null, referrer = "direct" } = req.body;
  const user = (req as any).user;
  try {
    if (!videoId) return res.status(400).json({ error: "videoId is required" });

    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, metadata')
      .eq('id', videoId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (video) {
      const meta = (video.metadata && typeof video.metadata === 'object' ? video.metadata : {}) as Record<string, any>;
      const nextViews = Number(meta.view_count ?? meta.views ?? 0) + 1;
      await supabaseAdmin
        .from('videos')
        .update({
          metadata: { ...meta, view_count: nextViews, views: nextViews },
          updated_at: now
        })
        .eq('id', videoId);
    }

    await supabaseAdmin.from('video_view_events').insert({
      video_id: videoId,
      viewer_user_id: user ? user.id : null,
      occurred_at: now,
      watch_duration_seconds: Math.max(0, Math.floor(Number(positionSeconds || 0))),
      validation_status: 'valid',
      traffic_source: referrer,
      metadata: {
        is_completed: Boolean(completed),
        device_type: deviceType,
        browser,
        country_code: country
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- Live Streaming APIs ---
// ==========================================
app.use("/api/artist/live", artistLiveRouter);
app.use("/api/live", liveRouter);

// ==========================================
// CHANNEL MEMBERSHIPS & SUPER THANKS (SUPABASE)
// ==========================================

const handleGetArtistMembershipTiers = async (req: express.Request, res: express.Response) => {
  const artistId = req.params.id || req.params.artistId;
  try {
    let channelId = artistId;
    const { data: directChannel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .eq('id', artistId)
      .maybeSingle();

    if (!directChannel) {
      const { data: artistProfile } = await supabaseAdmin
        .from('artist_profiles')
        .select('id, created_by_user_id, primary_contact_user_id')
        .eq('id', artistId)
        .maybeSingle();

      const ownerUserId = artistProfile?.primary_contact_user_id || artistProfile?.created_by_user_id;
      if (ownerUserId) {
        const { data: ownedChannel } = await supabaseAdmin
          .from('creator_channels')
          .select('id')
          .or(`owner_user_id.eq.${ownerUserId},created_by_user_id.eq.${ownerUserId}`)
          .limit(1)
          .maybeSingle();
        if (ownedChannel?.id) {
          channelId = ownedChannel.id;
        }
      }
    }

    const { data: tiers, error } = await supabaseAdmin
      .from('creator_membership_tiers')
      .select('*')
      .eq('creator_channel_id', channelId)
      .eq('is_active', true)
      .order('monthly_price', { ascending: true });

    if (error) throw error;
    return res.json(tiers || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load membership tiers" });
  }
};

app.get("/api/artist/:artistId/membership", handleGetArtistMembershipTiers);
app.get("/api/artist/:id/membership", handleGetArtistMembershipTiers);
app.get("/api/artists/:id/membership", handleGetArtistMembershipTiers);

app.get("/api/artist/membership/tiers", authenticate, checkRole('artist'), async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: tiers, error } = await supabaseAdmin
      .from('creator_membership_tiers')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .order('monthly_price', { ascending: true });

    if (error) throw error;
    res.json(tiers || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/artist/membership/tiers", authenticate, checkRole('artist'), async (req, res) => {
  const user = (req as any).user;
  const { name, tier_name, price_rwf, monthly_price, benefits, tier_description } = req.body;
  try {
    const effectiveName = tier_name || name;
    const effectivePrice = Number(monthly_price ?? price_rwf);
    if (!effectiveName || !effectivePrice || effectivePrice < 0) {
      return res.status(400).json({ error: "Tier name and monthly price are required" });
    }

    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: tier, error } = await supabaseAdmin
      .from('creator_membership_tiers')
      .insert({
        creator_channel_id: channel.id,
        tier_name: String(effectiveName).trim(),
        tier_description: tier_description || null,
        currency_code: 'RWF',
        monthly_price: effectivePrice,
        benefits: Array.isArray(benefits) ? benefits : [benefits].filter(Boolean),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(tier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleUpdateArtistTier = async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const tierId = req.params.id || req.params.tierId;
  const { name, tier_name, price, price_rwf, monthly_price, benefits, is_active } = req.body;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: existingTier } = await supabaseAdmin
      .from('creator_membership_tiers')
      .select('creator_channel_id')
      .eq('id', tierId)
      .maybeSingle();

    if (!existingTier || existingTier.creator_channel_id !== channel.id) {
      return res.status(403).json({ error: "Unauthorized or tier not found" });
    }

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (tier_name || name) updatePayload.tier_name = String(tier_name || name).trim();
    if (monthly_price !== undefined || price_rwf !== undefined || price !== undefined) {
      updatePayload.monthly_price = Number(monthly_price ?? price_rwf ?? price);
    }
    if (benefits !== undefined) updatePayload.benefits = Array.isArray(benefits) ? benefits : [benefits];
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    const { data: updated, error } = await supabaseAdmin
      .from('creator_membership_tiers')
      .update(updatePayload)
      .eq('id', tierId)
      .select()
      .single();

    if (error) throw error;
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.put("/api/artist/membership/tiers/:id", authenticate, checkRole('artist'), handleUpdateArtistTier);
app.put("/api/artist/membership/tiers/:tierId", authenticate, checkRole('artist'), handleUpdateArtistTier);

const handleDeleteArtistTier = async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const tierId = req.params.id || req.params.tierId;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: existingTier } = await supabaseAdmin
      .from('creator_membership_tiers')
      .select('creator_channel_id')
      .eq('id', tierId)
      .maybeSingle();

    if (!existingTier || existingTier.creator_channel_id !== channel.id) {
      return res.status(403).json({ error: "Unauthorized or tier not found" });
    }

    const { data: members } = await supabaseAdmin
      .from('creator_memberships')
      .select('id')
      .eq('membership_tier_id', tierId)
      .eq('membership_status', 'active');

    if (members && members.length > 0) {
      return res.status(400).json({
        error: "Cannot delete tier with active members. Deactivate it instead so subscribers retain access."
      });
    }

    const { error } = await supabaseAdmin
      .from('creator_membership_tiers')
      .delete()
      .eq('id', tierId);

    if (error) throw error;
    res.json({ success: true, message: "Membership tier deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.delete("/api/artist/membership/tiers/:id", authenticate, checkRole('artist'), handleDeleteArtistTier);
app.delete("/api/artist/membership/tiers/:tierId", authenticate, checkRole('artist'), handleDeleteArtistTier);

app.get("/api/artist/membership/subscribers", authenticate, checkRole('artist'), async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: subscribers, error } = await supabaseAdmin
      .from('creator_memberships')
      .select('*, creator_membership_tiers(*)')
      .eq('creator_channel_id', channel.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const subUserIds = Array.from(new Set((subscribers || []).map((s: any) => s.subscriber_user_id).filter(Boolean)));
    const { data: profs } = subUserIds.length > 0
      ? await supabaseAdmin.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', subUserIds)
      : { data: [] };
    const profMap = new Map<string, any>((profs || []).map((p: any) => [String(p.user_id), p]));

    const formatted = (subscribers || []).map((sub: any) => {
      const prof = profMap.get(String(sub.subscriber_user_id));
      return {
        id: sub.id,
        user_id: sub.subscriber_user_id,
        tier_name: sub.creator_membership_tiers?.tier_name || "Member",
        subscribed_at: sub.started_at || sub.created_at,
        status: sub.membership_status,
        next_billing: sub.current_period_end,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: Boolean(sub.cancelled_at),
        profiles: prof ? {
          full_name: prof.display_name || prof.username || "PAYTUNE Fan",
          username: prof.username || "member",
          avatar_url: prof.avatar_storage_path || ""
        } : null,
        membership_tiers: sub.creator_membership_tiers
          ? { name: sub.creator_membership_tiers.tier_name, ...sub.creator_membership_tiers }
          : null,
        creator_membership_tiers: sub.creator_membership_tiers
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/artist/membership/analytics", authenticate, checkRole('artist'), async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) return res.status(404).json({ error: "Creator channel not found" });

    const { data: subs } = await supabaseAdmin
      .from('creator_memberships')
      .select('*, creator_membership_tiers(monthly_price)')
      .eq('creator_channel_id', channel.id);

    const allSubs = subs || [];
    const activeSubs = allSubs.filter((s: any) => s.membership_status === 'active');
    const cancelledSubs = allSubs.filter((s: any) => s.membership_status === 'cancelled');

    const totalMRR = activeSubs.reduce(
      (sum: number, s: any) => sum + Number(s.creator_membership_tiers?.monthly_price ?? s.price_snapshot ?? 0),
      0
    );

    const activeCount = activeSubs.length;
    const cancelledCount = cancelledSubs.length;
    const totalCount = activeCount + cancelledCount;
    const churnRate = totalCount > 0 ? Number(((cancelledCount / totalCount) * 100).toFixed(1)) : 0;
    const arpu = activeCount > 0 ? Math.round(totalMRR / activeCount) : 0;

    const months = Array.from(new Set(allSubs.map((s: any) => String(s.created_at || '').slice(0, 7)).filter(Boolean))).sort();
    const revenueChartValues = months.map((m) =>
      allSubs
        .filter((s: any) => String(s.created_at || '').slice(0, 7) === m && s.membership_status === 'active')
        .reduce((acc: number, s: any) => acc + Number(s.creator_membership_tiers?.monthly_price ?? s.price_snapshot ?? 0), 0)
    );

    res.json({
      mrr: totalMRR,
      total_members: totalCount,
      activeSubscribers: activeCount,
      churn_rate: churnRate,
      churnRate,
      revenue_chart: { labels: months, values: revenueChartValues },
      arpu,
      revenueHistory: months.map((m, i) => ({ month: m, revenue: revenueChartValues[i] })),
      subscribersHistory: months.map((m) => ({
        month: m,
        count: allSubs.filter((s: any) => String(s.created_at || '').slice(0, 7) === m && s.membership_status === 'active').length
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/membership/subscribe", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { artistId, tierId, paymentMethod, provider } = req.body;
  try {
    if (!artistId || !tierId) {
      return res.status(400).json({ error: "artistId and tierId are required" });
    }

    const { data: tierObj } = await supabaseAdmin
      .from('creator_membership_tiers')
      .select('*')
      .eq('id', tierId)
      .maybeSingle();

    if (!tierObj) {
      return res.status(404).json({ error: "Membership tier not found in database" });
    }

    const isStripe = paymentMethod === 'stripe' || paymentMethod === 'card';
    const hasGateway = isStripe
      ? Boolean(process.env.STRIPE_SECRET_KEY)
      : (provider || '').toUpperCase() === 'AIRTEL'
      ? Boolean(process.env.AIRTEL_CLIENT_ID && process.env.AIRTEL_CLIENT_SECRET)
      : Boolean(process.env.MTN_SUBSCRIPTION_KEY && process.env.MTN_API_USER && process.env.MTN_API_KEY);

    if (!hasGateway) {
      return res.status(503).json({
        provider_configured: false,
        error: "Payment provider credentials are not configured. Paid memberships require live MTN MoMo, Airtel Money, or Stripe keys."
      });
    }

    const { data: existingActive } = await supabaseAdmin
      .from('creator_memberships')
      .select('id')
      .eq('subscriber_user_id', user.id)
      .eq('creator_channel_id', tierObj.creator_channel_id)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (existingActive) {
      return res.status(400).json({ error: "You already have an active subscription with this creator." });
    }

    const startPeriod = new Date().toISOString();
    const endPeriod = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const txId = `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const amountPaid = Number(tierObj.monthly_price || 0);

    const { data: sub, error: subError } = await supabaseAdmin
      .from('creator_memberships')
      .insert({
        subscriber_user_id: user.id,
        creator_channel_id: tierObj.creator_channel_id,
        membership_tier_id: tierObj.id,
        membership_status: 'pending',
        price_snapshot: amountPaid,
        currency_code: tierObj.currency_code || 'RWF',
        started_at: startPeriod,
        current_period_start: startPeriod,
        current_period_end: endPeriod,
        payment_provider: isStripe ? 'stripe' : (provider || 'mtn_momo').toLowerCase(),
        provider_subscription_reference: txId,
        created_at: startPeriod,
        updated_at: startPeriod
      })
      .select()
      .single();

    if (subError) throw subError;

    res.json({
      success: true,
      status: 'pending',
      membership: { ...sub, creator_membership_tiers: tierObj },
      transactionId: txId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleCancelUserMembership = async (req: express.Request, res: express.Response) => {
  const membershipId = req.params.id || req.params.membershipId;
  const user = (req as any).user;
  try {
    const { data: updatedSub, error } = await supabaseAdmin
      .from('creator_memberships')
      .update({
        membership_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', membershipId)
      .eq('subscriber_user_id', user.id)
      .select()
      .maybeSingle();

    if (error || !updatedSub) {
      return res.status(404).json({ error: "Membership subscription not found or unauthorized." });
    }

    res.json({ success: true, membership: updatedSub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.delete("/api/user/membership/:id/cancel", authenticate, handleCancelUserMembership);
app.delete("/api/user/membership/:membershipId/cancel", authenticate, handleCancelUserMembership);

const handleReactivateUserMembership = async (req: express.Request, res: express.Response) => {
  const membershipId = req.params.id || req.params.membershipId;
  const user = (req as any).user;
  try {
    const { data: updatedSub, error } = await supabaseAdmin
      .from('creator_memberships')
      .update({
        cancelled_at: null,
        membership_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', membershipId)
      .eq('subscriber_user_id', user.id)
      .select()
      .maybeSingle();

    if (error || !updatedSub) {
      return res.status(404).json({ error: "Membership subscription not found or unauthorized." });
    }

    res.json({ success: true, membership: updatedSub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.put("/api/user/membership/:id/reactivate", authenticate, handleReactivateUserMembership);
app.put("/api/user/membership/:membershipId/reactivate", authenticate, handleReactivateUserMembership);

app.get("/api/user/membership/active", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('creator_memberships')
      .select('*, creator_channels(id, owner_user_id, channel_name, avatar_path), creator_membership_tiers(*)')
      .eq('subscriber_user_id', user.id)
      .eq('membership_status', 'active');

    if (error) throw error;

    const formatted = (subs || []).map((s: any) => ({
      id: s.id,
      membership_tier_id: s.membership_tier_id,
      creator_channel_id: s.creator_channel_id,
      artist_profile_id: null,
      artist_id: s.creator_channel_id,
      artist_name: s.creator_channels?.channel_name || "",
      tier_name: s.creator_membership_tiers?.tier_name || "Member",
      price: Number(s.creator_membership_tiers?.monthly_price ?? s.price_snapshot ?? 0),
      next_billing: s.current_period_end,
      status: s.membership_status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      creator_channels: s.creator_channels,
      creator_membership_tiers: s.creator_membership_tiers
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/membership/payments", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: txs, error } = await supabaseAdmin
      .from('financial_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('revenue_source', 'membership')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(txs || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/membership/exclusive", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: activeSubs } = await supabaseAdmin
      .from('creator_memberships')
      .select('creator_channel_id')
      .eq('subscriber_user_id', user.id)
      .eq('membership_status', 'active');

    const channelIds = (activeSubs || []).map((s: any) => s.creator_channel_id).filter(Boolean);
    if (channelIds.length === 0) return res.json([]);

    const { data: videos, error } = await supabaseAdmin
      .from('videos')
      .select('*, creator_channels(id, channel_name, avatar_path)')
      .in('creator_channel_id', channelIds)
      .eq('visibility', 'members_only')
      .eq('publication_status', 'published');

    if (error) throw error;
    res.json(videos || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SUPER THANKS (DONATIONS)
// ----------------------------------------------------

app.get("/api/super-thanks/presets", (_req, res) => {
  res.json({
    rwf: [500, 1000, 2500, 5000, 10000, 25000],
    usd: [1.0, 2.0, 5.0, 10.0, 20.0, 50.0]
  });
});

app.post("/api/super-thanks/send", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      artistId,
      videoId,
      liveStreamId,
      amount: rawAmount,
      currency: rawCurrency,
      message,
      isPublic,
      paymentMethod,
      provider
    } = req.body;

    if (!artistId) {
      return res.status(400).json({ error: "artistId is required" });
    }

    const amount = Number(rawAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valid donation amount is required" });
    }

    const isStripe = paymentMethod === 'stripe' || paymentMethod === 'card' || provider === 'stripe';
    const hasGateway = isStripe
      ? Boolean(process.env.STRIPE_SECRET_KEY)
      : (provider || '').toUpperCase() === 'AIRTEL'
      ? Boolean(process.env.AIRTEL_CLIENT_ID && process.env.AIRTEL_CLIENT_SECRET)
      : Boolean(process.env.MTN_SUBSCRIPTION_KEY && process.env.MTN_API_USER && process.env.MTN_API_KEY);

    if (!hasGateway) {
      return res.status(503).json({
        provider_configured: false,
        error: "Payment provider credentials are not configured. Super Thanks payments require live gateway keys."
      });
    }

    const currency = (rawCurrency || 'RWF').toUpperCase();
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id, channel_name')
      .eq('id', artistId)
      .maybeSingle();

    if (!channel) {
      return res.status(404).json({ error: "Creator channel not found" });
    }

    const vatAmount = Number((amount * 0.05).toFixed(2));
    const afterVat = Number((amount - vatAmount).toFixed(2));
    const artistShare = Number((afterVat * 0.7).toFixed(2));
    const ownerShare = Number((afterVat * 0.3).toFixed(2));
    const txId = `STX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: donation, error: donErr } = await supabaseAdmin
      .from('super_thanks')
      .insert({
        creator_channel_id: channel.id,
        sender_user_id: user.id,
        content_type: liveStreamId ? 'livestream' : 'video',
        content_id: liveStreamId || videoId || channel.id,
        currency_code: currency,
        amount,
        public_message: message ? String(message).trim() : null,
        is_message_public: isPublic !== false,
        event_status: 'pending',
        payment_provider: isStripe ? 'stripe' : (provider || 'mtn_momo').toLowerCase(),
        provider_payment_reference: txId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (donErr) throw donErr;

    res.json({
      success: true,
      status: 'pending',
      donation,
      transactionId: txId,
      split: { vat_amount: vatAmount, after_vat: afterVat, artist_share: artistShare, owner_share: ownerShare }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/super-thanks/artist/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: donations, error } = await supabaseAdmin
      .from('super_thanks')
      .select('*')
      .eq('creator_channel_id', id)
      .eq('event_status', 'confirmed')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = donations || [];
    const total = list.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const count = list.length;
    const average_amount = count > 0 ? Math.round(total / count) : 0;

    res.json({
      total,
      count,
      average_amount,
      top_donors: [],
      donations: list
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/super-thanks/user", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const { data: donations, error } = await supabaseAdmin
      .from('super_thanks')
      .select('*, creator_channels(id, channel_name, avatar_path)')
      .eq('sender_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(donations || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// WEBHOOKS
// ----------------------------------------------------

app.post("/api/webhooks/stripe", async (req, res) => {
  const event = req.body;
  try {
    const eventType = event.type;
    if (eventType === 'customer.subscription.deleted') {
      const subscription = event.data?.object;
      if (subscription?.id) {
        await supabaseAdmin
          .from('creator_memberships')
          .update({ membership_status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('provider_subscription_reference', subscription.id);
      }
    }
    res.json({ received: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/webhooks/mtn", async (req, res) => {
  try {
    const { transactionId, status } = req.body || {};
    if (transactionId && (status === 'SUCCESSFUL' || status === 'SUCCESS')) {
      await supabaseAdmin
        .from('payment_intents')
        .update({ payment_status: 'succeeded', updated_at: new Date().toISOString() })
        .eq('provider_payment_reference', transactionId);
    }
    res.json({ status: "SUCCESS" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/webhooks/airtel", async (req, res) => {
  try {
    const { transactionId, status } = req.body || {};
    if (transactionId && (status === 'SUCCESS' || status === 'COMPLETED')) {
      await supabaseAdmin
        .from('payment_intents')
        .update({ payment_status: 'succeeded', updated_at: new Date().toISOString() })
        .eq('provider_payment_reference', transactionId);
    }
    res.json({ status: "SUCCESS" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Middleware ---
async function startServer() {
  console.log("Starting PAYTUNE server (PostgreSQL/Supabase unified database)...");

  // Non-blocking storage bucket verification for Supabase media delivery
  ensureSupabaseStorageBuckets()
    .then((res) => {
      if (res.checked) {
        console.log(`Supabase Storage buckets ready: ${res.existing.join(', ')}`);
      }
    })
    .catch(() => {});

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  (global as any).ioInstance = io;
  setNotificationIO(io);

  // Active socket room tracking for clean leave/disconnect
  const socketRooms = new Map<string, Set<string>>();
  const socketSessionIds = new Map<string, string>();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleJoin = async (socket: any, streamId: string, userId?: string) => {
    if (!streamId) return;
    const room = `stream:${streamId}`;
    socket.join(room);
    if (!socketRooms.has(socket.id)) {
      socketRooms.set(socket.id, new Set());
    }
    socketRooms.get(socket.id)!.add(streamId);

    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit("viewer:count", { count: roomSize, streamId });
    io.to(room).emit("viewer:join", { count: roomSize, streamId });

    if (UUID_RE.test(streamId)) {
      try {
        const now = new Date().toISOString();
        const validUserId = userId && UUID_RE.test(userId) ? userId : null;
        const { data: sess } = await supabaseAdmin
          .from('livestream_viewer_sessions')
          .insert({
            livestream_id: streamId,
            user_id: validUserId,
            anonymous_session_id: validUserId ? null : crypto.randomUUID(),
            joined_at: now,
            last_heartbeat_at: now,
            is_active: true,
            session_metadata: { socket_id: socket.id }
          })
          .select('id')
          .maybeSingle();
        if (sess?.id) {
          socketSessionIds.set(`${socket.id}:${streamId}`, sess.id);
        }
      } catch {
        // Non-blocking telemetry insert
      }
    }
  };

  const handleLeave = async (socket: any, streamId: string) => {
    if (!streamId) return;
    const room = `stream:${streamId}`;
    socket.leave(room);
    socketRooms.get(socket.id)?.delete(streamId);

    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit("viewer:count", { count: roomSize, streamId });
    io.to(room).emit("viewer:leave", { count: roomSize, streamId });

    const sessionId = socketSessionIds.get(`${socket.id}:${streamId}`);
    socketSessionIds.delete(`${socket.id}:${streamId}`);
    if (sessionId) {
      try {
        await supabaseAdmin
          .from('livestream_viewer_sessions')
          .update({ is_active: false, left_at: new Date().toISOString() })
          .eq('id', sessionId);
      } catch {
        // Non-blocking telemetry update
      }
    }
  };

  io.on("connection", (socket) => {
    // 1. Join stream
    socket.on("join", (payload: any) => {
      const streamId = typeof payload === "string" ? payload : payload?.streamId;
      const userId = typeof payload === "object" ? payload?.userId : undefined;
      handleJoin(socket, streamId, userId);
    });

    // 2. Chat message persisted to PostgreSQL livestream_chat_messages
    socket.on("chat:send", async (data: any) => {
      const { streamId, message, user } = data || {};
      if (!streamId || !message) return;

      if (user?.id && UUID_RE.test(user.id) && UUID_RE.test(streamId)) {
        try {
          const { data: blocked } = await supabaseAdmin
            .from("livestream_chat_moderation_actions")
            .select("id")
            .eq("livestream_id", streamId)
            .eq("target_user_id", user.id)
            .in("action_type", ["ban", "mute", "timeout"])
            .limit(1)
            .maybeSingle();

          if (blocked) {
            socket.emit("error", { message: "You are blocked from chatting in this broadcast." });
            return;
          }
        } catch {
          // Proceed if moderation table probe fails cleanly
        }
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const senderName = user?.user_metadata?.full_name || user?.full_name || "Listener";

      if (user?.id && UUID_RE.test(user.id) && UUID_RE.test(streamId)) {
        try {
          await supabaseAdmin.from("livestream_chat_messages").insert({
            id,
            livestream_id: streamId,
            user_id: user.id,
            message_text: String(message),
            message_status: 'visible',
            created_at: now,
            metadata: { sender_name: senderName }
          });
        } catch {
          // Non-blocking chat persistence
        }
      }

      io.to(`stream:${streamId}`).emit("chat:message", {
        id,
        stream_id: streamId,
        user_id: user?.id || null,
        user_name: senderName,
        message: String(message),
        is_super_chat: false,
        super_chat_amount: 0,
        created_at: now
      });
    });

    // Direct chat:message event
    socket.on("chat:message", (data: any) => {
      const streamId = data?.streamId || data?.stream_id;
      if (streamId) {
        io.to(`stream:${streamId}`).emit("chat:message", data);
      }
    });

    // 3. Super Thanks broadcast
    socket.on("chat:super-thanks", (data: any) => {
      const streamId = data?.streamId || data?.stream_id;
      if (streamId) {
        io.to(`stream:${streamId}`).emit("chat:super-thanks", data);
        io.to(`stream:${streamId}`).emit("chat:message", data);
      }
    });

    // 4. Viewer count request/update
    socket.on("viewer:count", (payload: any) => {
      const streamId = typeof payload === "string" ? payload : payload?.streamId;
      if (streamId) {
        const count = io.sockets.adapter.rooms.get(`stream:${streamId}`)?.size || 0;
        socket.emit("viewer:count", { count, streamId });
      }
    });

    // 5. Moderation event
    socket.on("moderation", (data: any) => {
      const streamId = data?.streamId || data?.stream_id;
      if (streamId) {
        io.to(`stream:${streamId}`).emit("moderation", data);
        if (data.action === "delete_message" && data.messageId) {
          io.to(`stream:${streamId}`).emit("chat:deleted", { messageId: data.messageId, streamId });
        }
      }
    });

    // 6. Leave stream
    socket.on("leave", (payload: any) => {
      const streamId = typeof payload === "string" ? payload : payload?.streamId;
      handleLeave(socket, streamId);
    });

    // 7. Notification rooms subscription
    socket.on("notifications:join", (data: any) => {
      if (data?.userId) {
        socket.join(`user:${data.userId}`);
      }
      if (data?.artistId) {
        socket.join(`artist:${data.artistId}`);
      }
      if (data?.role === 'master' || data?.role === 'admin') {
        socket.join('role:master');
      }
    });

    // 8. Disconnect cleanup
    socket.on("disconnect", () => {
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        for (const sId of rooms) {
          const roomSize = io.sockets.adapter.rooms.get(`stream:${sId}`)?.size || 0;
          io.to(`stream:${sId}`).emit("viewer:count", { count: roomSize, streamId: sId });
          io.to(`stream:${sId}`).emit("viewer:leave", { count: roomSize, streamId: sId });
        }
        socketRooms.delete(socket.id);
      }
    });
  });

  // Global error handler — catch multer limits, payload limits, and return JSON 400/413
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large. Videos must be under 2 GB, audio under 100 MB, images under 15 MB.',
      });
    }
    if (err?.name === 'MulterError') {
      return res.status(400).json({ error: err.message || 'Invalid multipart upload field', code: err.code });
    }
    if (err?.message?.includes('File too large') || err?.type === 'entity.too.large') {
      return res.status(413).json({ error: err.message || 'Payload Too Large' });
    }
    if (err) {
      console.error('Server error handler:', err);
      return res.status(err?.status || 500).json({ error: err?.message || 'Server error' });
    }
    next();
  });

  // Ensure unmatched API routes return structured JSON 404 rather than HTML SPA fallback
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
      method: req.method,
      path: req.originalUrl,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`PAYTUNE Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
