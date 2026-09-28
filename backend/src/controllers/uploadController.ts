import { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { uploadBuffer } from '../services/storageService';
import { ArtistRequest } from '../middleware/authArtist';

const db = supabaseAdmin || supabase;

// POST /api/artist/upload/avatar  (multipart, field: avatar)
export async function uploadAvatar(req: ArtistRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Avatar file required' });
    if (file.size > 5 * 1024 * 1024) return res.status(400).json({ error: 'Max 5MB' });

    const userId = req.artistUserId || req.artistId || 'artist';
    const { url } = await uploadBuffer({
      bucket: 'avatars',
      userId,
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    if (req.artistId) {
      await db.from('artists').update({
        avatar_url: url,
        profile_image: url,
        updated_at: new Date().toISOString()
      }).eq('id', req.artistId);
    }

    return res.json({ success: true, url });
  } catch (err: any) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ error: err.message || 'Avatar upload failed' });
  }
}

// POST /api/artist/upload/banner  (multipart, field: banner)
export async function uploadBanner(req: ArtistRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Banner file required' });
    if (file.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'Max 10MB' });

    const userId = req.artistUserId || req.artistId || 'artist';
    const { url } = await uploadBuffer({
      bucket: 'banners',
      userId,
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    if (req.artistId) {
      await db.from('artists').update({
        banner_url: url,
        banner_image: url,
        updated_at: new Date().toISOString()
      }).eq('id', req.artistId);
    }

    return res.json({ success: true, url });
  } catch (err: any) {
    console.error('uploadBanner error:', err);
    return res.status(500).json({ error: err.message || 'Banner upload failed' });
  }
}

// POST /api/artist/upload/thumbnail  (multipart, field: thumbnail) – returns URL only
export async function uploadThumbnail(req: ArtistRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Thumbnail file required' });
    if (file.size > 5 * 1024 * 1024) return res.status(400).json({ error: 'Max 5MB' });

    const userId = req.artistUserId || req.artistId || 'artist';
    const { url } = await uploadBuffer({
      bucket: 'thumbnails',
      userId,
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    return res.json({ success: true, url });
  } catch (err: any) {
    console.error('uploadThumbnail error:', err);
    return res.status(500).json({ error: err.message || 'Thumbnail upload failed' });
  }
}
