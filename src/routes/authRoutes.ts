import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { rawSupabaseAdmin, resolveSupabaseKeys, supabase, supabaseAdmin, supabaseProjectInfo } from '../config/supabase';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { getJwtSecret } from '../utils/jwtSecret';
import {
  registerArtist,
  loginArtist,
  detectArtistCountry,
  getArtistMe
} from '../controllers/artistAuthController';

const router = Router();
const JWT_EXPIRES_IN = '7d';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/artist/register', optionalAuthenticate, registerArtist);
router.post('/artist/login', loginArtist);
router.get('/artist/geo/detect', detectArtistCountry);
router.get('/artist/me', authenticate, getArtistMe);

function generateToken(user: { id: string; email: string; role?: string; fullName?: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role || 'user',
      fullName: user.fullName || 'User',
      user_metadata: {
        full_name: user.fullName || 'User',
        role: user.role || 'user'
      }
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * Registers user strictly via Supabase Auth & creates PostgreSQL profile + role assignment.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, username } = req.body || {};

    const errors: Record<string, string> = {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }
    if (!password || typeof password !== 'string') {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: Object.values(errors)[0],
        errors
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const baseUsername =
      typeof username === 'string' && username.trim()
        ? username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)
        : cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 23) || 'user';
    const cleanUsername = `${baseUsername || 'user'}_${Date.now().toString(36).slice(-4)}`.slice(0, 30);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: cleanName.slice(0, 100), username: cleanUsername, role: 'user' }
      }
    });

    if (error || !data?.user) {
      const msg = error?.message || 'Unable to register account with Supabase Auth.';
      const isDuplicate = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered');
      const isRateLimit = msg.toLowerCase().includes('rate limit');
      return res.status(isDuplicate ? 409 : isRateLimit ? 429 : 400).json({
        success: false,
        error: isDuplicate ? 'account_exists' : isRateLimit ? 'rate_limited' : 'registration_failed',
        message: msg
      });
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    const nowIso = new Date().toISOString();
    try {
      await client.from('profiles').upsert({
        user_id: data.user.id,
        display_name: cleanName.slice(0, 100),
        username: `${baseUsername.slice(0, 23) || 'user'}_${data.user.id.slice(0, 6)}`.slice(0, 30),
        account_status: 'active',
        preferred_language_code: 'en',
        created_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });

      const { data: existingRoles } = await client
        .from('user_role_assignments')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('role', 'user')
        .limit(1);
      if (!existingRoles || existingRoles.length === 0) {
        await client.from('user_role_assignments').insert({
          user_id: data.user.id,
          role: 'user',
          is_active: true,
        });
      }
    } catch {
      // Profile sync handled best-effort if trigger already created row
    }

    const requiresEmailConfirmation = !data.session?.access_token;

    return res.status(201).json({
      success: true,
      requiresEmailConfirmation,
      message: data.session
        ? 'Account registered successfully.'
        : 'Account created. Please check your email to confirm before signing in.',
      token: data.session?.access_token || null,
      redirectTo: data.session ? '/dashboard' : '/auth',
      user: {
        id: data.user.id,
        email: cleanEmail,
        fullName: cleanName,
        role: 'user'
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: err?.message || 'An unexpected error occurred during registration.'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates strictly via Supabase Auth + resolves RBAC role from DB.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const errors: Record<string, string> = {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.email = 'Email address is required.';
    }
    if (!password || typeof password !== 'string') {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: Object.values(errors)[0],
        errors
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (req.body?.role === 'artist') {
      return loginArtist(req, res);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error || !data?.user) {
      const msg = error?.message || 'Invalid email or password.';
      const isUnconfirmed = msg.toLowerCase().includes('email not confirmed');
      return res.status(401).json({
        success: false,
        error: isUnconfirmed ? 'email_not_confirmed' : 'invalid_credentials',
        message: isUnconfirmed
          ? 'Your email address has not been confirmed. Please check your inbox before signing in.'
          : 'Invalid email or password.'
      });
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    const [{ data: roleRows }, { data: artistProfile }, { data: profileData }] = await Promise.all([
      client.from('user_role_assignments').select('role').eq('user_id', data.user.id).eq('is_active', true),
      client
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${data.user.id},primary_contact_user_id.eq.${data.user.id}`)
        .maybeSingle(),
      client.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle(),
    ]);

    if (profileData?.account_status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'account_blocked',
        message: 'Your account has been suspended. Please contact PAYTUNE support.'
      });
    }

    let resolvedRole = 'user';
    const roles = (roleRows || []).map((r: any) => String(r.role).toLowerCase());
    if (roles.includes('master_admin') || roles.includes('master')) {
      resolvedRole = 'master';
    } else if (roles.includes('admin')) {
      resolvedRole = 'admin';
    } else if (artistProfile || roles.includes('artist')) {
      resolvedRole = 'artist';
    }

    const fullName =
      profileData?.display_name ||
      artistProfile?.artist_name ||
      data.user.user_metadata?.full_name ||
      cleanEmail.split('@')[0];

    const redirectTo =
      resolvedRole === 'master' || resolvedRole === 'admin'
        ? '/master'
        : resolvedRole === 'artist'
        ? '/artist/dashboard'
        : '/dashboard';

    const token =
      data.session?.access_token ||
      generateToken({
        id: data.user.id,
        email: cleanEmail,
        role: resolvedRole,
        fullName
      });

    return res.json({
      success: true,
      token,
      role: resolvedRole,
      redirectTo,
      artist: artistProfile || null,
      user: {
        id: data.user.id,
        email: cleanEmail,
        full_name: fullName,
        role: resolvedRole
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: err?.message || 'An unexpected error occurred during login.'
    });
  }
});

/**
 * GET /api/auth/google/status
 */
router.get('/google/status', async (_req: Request, res: Response) => {
  const projectId = supabaseProjectInfo.projectId;
  const supabaseUrl = supabaseProjectInfo.url;
  const callbackUrl = `${supabaseUrl}/auth/v1/callback`;
  const setupUrl = `https://supabase.com/dashboard/project/${projectId}/auth/providers`;

  try {
    const { anonKey, serviceKey } = resolveSupabaseKeys();
    const apiKey = anonKey || serviceKey;
    const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: apiKey ? { apikey: apiKey } : {},
    });
    let googleEnabled = false;
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      googleEnabled = Boolean(settings?.external?.google);
    }

    return res.json({
      supported: googleEnabled,
      projectId,
      googleEnabled,
      callbackUrl,
      setupUrl,
      error: googleEnabled ? null : 'unsupported_provider',
      message: googleEnabled
        ? 'Google OAuth provider is active.'
        : 'Google OAuth provider is not enabled in your Supabase dashboard settings.'
    });
  } catch {
    return res.json({
      supported: false,
      projectId,
      googleEnabled: false,
      callbackUrl,
      setupUrl,
      error: 'unsupported_provider',
      message: 'Google OAuth provider status could not be verified directly.'
    });
  }
});

router.post('/google/demo', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'demo_auth_disabled',
    message: 'Simulated Google Sign-In has been disabled. Use configured Supabase Google OAuth.'
  });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No active session.'
      });
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    let [{ data: roleRows }, { data: artistProfile }, { data: channel }, { data: profileData }] = await Promise.all([
      client.from('user_role_assignments').select('role').eq('user_id', user.id).eq('is_active', true),
      client
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
        .maybeSingle(),
      client
        .from('creator_channels')
        .select('*')
        .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
        .maybeSingle(),
      client.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    // Auto-provision missing profile row for newly signed-up Supabase Auth users
    if (!profileData) {
      const nowIso = new Date().toISOString();
      const fallbackName =
        user.user_metadata?.full_name ||
        (user.email ? String(user.email).split('@')[0] : 'PAYTUNE Member');
      const baseHandle = (user.user_metadata?.username || fallbackName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 23) || 'user';
      const fallbackUsername = `${baseHandle}_${String(user.id).slice(0, 6)}`.slice(0, 30);

      const { data: insertedProfile } = await client
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            username: fallbackUsername,
            display_name: String(fallbackName).slice(0, 100),
            preferred_language_code: 'en',
            account_status: 'active',
            created_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .maybeSingle();

      if (insertedProfile) {
        profileData = insertedProfile;
      }
    }

    const roles = (roleRows || []).map((r: any) => String(r.role).toLowerCase());
    if (roles.length === 0) {
      try {
        await client.from('user_role_assignments').insert({
          user_id: user.id,
          role: 'user',
          is_active: true,
        });
      } catch {
        // Ignore non-fatal role bootstrap conflict
      }
    }

    let resolvedRole = 'user';
    const fullName =
      profileData?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    let roleData: any = {
      ...(profileData || { user_id: user.id, display_name: fullName }),
      id: user.id,
      full_name: fullName,
      role: 'user',
    };

    if (roles.includes('master_admin') || roles.includes('master')) {
      resolvedRole = 'master';
      roleData = {
        id: user.id,
        is_master: true,
        role: 'master',
        full_name: fullName,
      };
    } else if (roles.includes('admin')) {
      resolvedRole = 'admin';
      roleData = {
        ...(profileData || {}),
        id: user.id,
        role: 'admin',
        full_name: fullName,
      };
    } else if (artistProfile || channel) {
      resolvedRole = 'artist';
      roleData = {
        ...(artistProfile || channel),
        id: artistProfile?.id || channel?.id,
        user_id: user.id,
        channel_id: channel?.id || null,
        full_name: artistProfile?.artist_name || channel?.channel_name || fullName,
        role: 'artist',
      };
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: resolvedRole,
        fullName,
        metadata: user.user_metadata || {}
      },
      profile: profileData || null,
      artist: artistProfile || null,
      channel: channel || null,
      roleData,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to retrieve user profile.'
    });
  }
});

router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    fullName: user.user_metadata?.full_name || user.email?.split('@')[0]
  });

  return res.json({ success: true, token });
});

export default router;
