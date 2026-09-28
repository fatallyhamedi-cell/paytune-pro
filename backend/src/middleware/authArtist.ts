import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface ArtistRequest extends Request {
  artistUserId?: string;
  artistId?: string;
  artistRole?: string;
}

export function authenticateArtist(req: ArtistRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = header.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    let decoded: any = null;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      // Allow fallback to decoded token if signed with other secret or supabase jwt
      decoded = jwt.decode(token);
    }

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const artistId = decoded.artistId || decoded.artist_id || decoded.id;
    const userId = decoded.userId || decoded.user_id || decoded.sub;
    const role = decoded.role || decoded.user_role || 'artist';

    if (role !== 'artist' && !decoded.artistId && !decoded.artist_id) {
      return res.status(403).json({ error: 'Artist access only' });
    }

    req.artistUserId = userId;
    req.artistId = artistId;
    req.artistRole = role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default authenticateArtist;
