import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rawSupabaseAdmin, supabase, supabaseAdmin } from '../config/supabase';
import { getJwtSecret } from '../utils/jwtSecret';

export const authenticateArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawHeader = req.headers.authorization || (req.headers['x-access-token'] as string);
    if (!rawHeader) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    let token = rawHeader.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const db = rawSupabaseAdmin || supabaseAdmin || supabase;
    const secretsToTry = Array.from(
      new Set(
        [getJwtSecret(), process.env.JWT_SECRET, process.env.SUPABASE_JWT_SECRET]
          .filter((s): s is string => Boolean(s && s.trim().length >= 16))
          .map((s) => s.trim())
      )
    );

    let resolvedUserId: string | null = null;
    let resolvedArtistId: string | null = null;
    let resolvedRole = 'artist';
    let tokenPayload: any = null;

    for (const secret of secretsToTry) {
      try {
        const decoded = jwt.verify(token, secret) as any;
        const roleLower = String(decoded?.role || '').toLowerCase();
        if (decoded && (roleLower === 'artist' || roleLower === 'creator' || roleLower === 'master_admin' || roleLower === 'master' || decoded.artistId || decoded.channelId)) {
          resolvedUserId = decoded.userId || decoded.id || decoded.sub || null;
          resolvedArtistId = decoded.artistId || null;
          resolvedRole = decoded.role || 'artist';
          tokenPayload = decoded;
          break;
        }
      } catch {
        // Try next secret or fall through to Supabase Auth verification
      }
    }

    if (!resolvedUserId) {
      const authClient = supabaseAdmin || supabase;
      const { data: { user }, error } = await authClient.auth.getUser(token);
      if (!error && user) {
        resolvedUserId = user.id;
        tokenPayload = user;
      }
    }

    if (!resolvedUserId) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }

    // Resolve authoritative artist profile & creator channel in PostgreSQL
    let artistProfile: any = null;
    if (resolvedArtistId) {
      const { data } = await db.from('artist_profiles').select('*').eq('id', resolvedArtistId).maybeSingle();
      artistProfile = data;
    }
    if (!artistProfile) {
      const { data } = await db
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${resolvedUserId},primary_contact_user_id.eq.${resolvedUserId}`)
        .limit(1)
        .maybeSingle();
      artistProfile = data;
    }

    const { data: channel } = await db
      .from('creator_channels')
      .select('*')
      .or(`owner_user_id.eq.${resolvedUserId},created_by_user_id.eq.${resolvedUserId}`)
      .limit(1)
      .maybeSingle();

    if (!artistProfile && !channel && resolvedRole !== 'master_admin' && resolvedRole !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Artist profile or creator channel required' });
    }

    (req as any).userId = resolvedUserId;
    (req as any).artistId = artistProfile?.id || channel?.id || resolvedArtistId;
    (req as any).channelId = channel?.id || null;
    (req as any).role = resolvedRole;
    (req as any).user = tokenPayload;
    (req as any).roleData = artistProfile || channel;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
