import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rawSupabaseAdmin, supabase, supabaseAdmin } from '../../../src/config/supabase';

export interface ArtistRequest extends Request {
  artistUserId?: string;
  artistId?: string;
  channelId?: string;
  artistRole?: string;
}

export async function authenticateArtist(req: ArtistRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.substring(7).trim();
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwtSecret = process.env.JWT_SECRET || '';
    const db = rawSupabaseAdmin || supabaseAdmin || supabase;

    let userId: string | undefined;
    let artistId: string | undefined;
    let role = 'artist';

    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as any;
        userId = decoded?.userId || decoded?.user_id || decoded?.sub;
        artistId = decoded?.artistId || decoded?.artist_id;
        role = decoded?.role || decoded?.user_role || 'artist';
      } catch {
        // Fall through to Supabase Auth check
      }
    }

    if (!userId) {
      const authClient = supabaseAdmin || supabase;
      const { data: { user }, error } = await authClient.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        role = String(user.user_metadata?.role || 'artist');
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { data: artistProfile } = await db
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();

    const { data: channel } = await db
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();

    const resolvedArtistId = artistProfile?.id || artistId || channel?.id;
    if (!resolvedArtistId && role !== 'master_admin' && role !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Artist access only' });
    }

    req.artistUserId = userId;
    req.artistId = resolvedArtistId;
    req.channelId = channel?.id;
    req.artistRole = role;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default authenticateArtist;
