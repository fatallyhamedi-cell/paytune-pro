import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rawSupabaseAdmin, supabase, supabaseAdmin } from '../config/supabase';
import { getJwtSecret } from '../utils/jwtSecret';

async function verifyTokenAndResolveUser(token: string): Promise<any | null> {
  if (!token || token === 'null' || token === 'undefined') return null;

  const secretsToTry = Array.from(
    new Set(
      [getJwtSecret(), process.env.JWT_SECRET, process.env.SUPABASE_JWT_SECRET]
        .filter((s): s is string => Boolean(s && s.trim().length >= 16))
        .map((s) => s.trim())
    )
  );

  for (const secret of secretsToTry) {
    try {
      const decoded = jwt.verify(token, secret) as any;
      if (decoded && (decoded.userId || decoded.id || decoded.sub)) {
        const userId = String(decoded.userId || decoded.id || decoded.sub);
        return {
          id: userId,
          userId,
          artistId: decoded.artistId,
          channelId: decoded.channelId,
          email: decoded.email || '',
          role: decoded.role || 'user',
          country_code: decoded.country_code,
          currency_code: decoded.currency_code,
          user_metadata: decoded.user_metadata || {
            full_name: decoded.fullName || decoded.full_name || decoded.name || decoded.email?.split('@')[0] || 'User',
            role: decoded.role || 'user',
            artistId: decoded.artistId,
            channelId: decoded.channelId,
          },
        };
      }
    } catch {
      // Try next secret or fall through to Supabase Auth JWT validation
    }
  }

  try {
    const authClient = supabaseAdmin || supabase;
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (user && !error) {
      const db = rawSupabaseAdmin || supabaseAdmin;
      let resolvedRole = String(user.app_metadata?.role || 'user').toLowerCase();
      if (db) {
        const { data: roleRows } = await db
          .from('user_role_assignments')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true);
        const roles = (roleRows || []).map((r: any) => String(r.role).toLowerCase());
        if (roles.includes('master_admin') || roles.includes('master')) {
          resolvedRole = 'master_admin';
        } else if (roles.includes('admin')) {
          resolvedRole = 'admin';
        } else if (roles.includes('artist')) {
          resolvedRole = 'artist';
        }
      }
      return {
        ...user,
        userId: user.id,
        role: resolvedRole === 'authenticated' ? 'user' : resolvedRole,
      };
    }
  } catch {
    // Token invalid or Supabase unavailable
  }

  return null;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawHeader = req.headers.authorization || (req.headers['x-access-token'] as string);
    if (!rawHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided. Please log in.',
      });
    }

    let token = rawHeader.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    const user = await verifyTokenAndResolveUser(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired session. Please log in again.',
      });
    }

    (req as any).user = user;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token verification failed. Please log in.',
    });
  }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const rawHeader = req.headers.authorization || (req.headers['x-access-token'] as string);
    if (!rawHeader) return next();

    let token = rawHeader.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    const user = await verifyTokenAndResolveUser(token);
    if (user) {
      (req as any).user = user;
    }
  } catch {
    // Non-blocking for optional authentication
  }
  return next();
};

export const checkRole = (role: 'user' | 'artist' | 'master' | 'MASTER_ADMIN') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const db = rawSupabaseAdmin || supabaseAdmin || supabase;

    if (role === 'artist') {
      let { data: artistProfile } = await db
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();

      if (!artistProfile) {
        const { data: membership } = await db
          .from('artist_members')
          .select('artist_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (membership?.artist_id) {
          const { data: memberArtist } = await db
            .from('artist_profiles')
            .select('*')
            .eq('id', membership.artist_id)
            .maybeSingle();
          artistProfile = memberArtist || null;
        }
      }

      const { data: channel } = await db
        .from('creator_channels')
        .select('*')
        .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();

      if (!artistProfile && !channel) {
        return res.status(403).json({ success: false, message: 'Artist profile or creator channel access required.' });
      }

      (req as any).roleData = artistProfile || channel;
      (req as any).artistId = artistProfile?.id || channel?.id;
      (req as any).channelId = channel?.id;
      return next();
    }

    if (role === 'master' || role === 'MASTER_ADMIN') {
      const candidateRoles = [user.role, user.app_metadata?.role]
        .filter((r): r is string => Boolean(r))
        .map((r) => String(r).toLowerCase())
        .filter((r) => r !== 'authenticated' && r !== 'anon');

      if (candidateRoles.includes('master_admin') || candidateRoles.includes('master')) {
        (req as any).roleData = { role: 'MASTER_ADMIN', is_master: true };
        return next();
      }

      const { data: assignment } = await db
        .from('user_role_assignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('role', ['admin', 'master_admin', 'master'])
        .limit(1)
        .maybeSingle();

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Master Admin access required (active master_admin/admin role assignment missing).',
        });
      }

      (req as any).roleData = assignment;
      return next();
    }

    return next();
  };
};
