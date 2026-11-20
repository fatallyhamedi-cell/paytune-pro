import crypto from 'crypto';

let cachedEphemeralSecret: string | null = null;

/**
 * Resolves a consistent HMAC signing/verification secret across all auth routes,
 * login controllers, and token verification middleware.
 * Checks JWT_SECRET, then SUPABASE_JWT_SECRET, then derives a stable key from
 * SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY so local/sandbox auth never fails
 * with HTTP 503 when only Supabase environment variables are present.
 */
export function getJwtSecret(): string {
  const candidates = [process.env.JWT_SECRET, process.env.SUPABASE_JWT_SECRET];

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length >= 16) {
      return candidate.trim();
    }
  }

  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (seed.trim().length >= 16) {
    return crypto.createHash('sha256').update(`paytune-jwt::${seed.trim()}`).digest('hex');
  }

  if (!cachedEphemeralSecret) {
    cachedEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }

  return cachedEphemeralSecret;
}
