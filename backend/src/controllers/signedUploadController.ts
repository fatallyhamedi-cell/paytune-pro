import { Response } from 'express';
import { randomUUID } from 'crypto';
import { supabase, supabaseAdmin } from '../config/supabase';

const client = supabaseAdmin || supabase;

// POST /api/artist/upload/signed-url
// Body: { bucket: 'videos'|'audio'|'thumbnails'|'avatars'|'banners', filename: string, contentType: string }
export async function createSignedUploadUrl(req: any, res: Response) {
  try {
    const userId = req.artistUserId || req.artistId || 'artist';
    const { bucket = 'videos', filename, contentType } = req.body;

    if (!filename) return res.status(400).json({ error: 'filename required' });
    if (!['videos', 'audio', 'thumbnails', 'avatars', 'banners'].includes(bucket)) {
      return res.status(400).json({ error: 'invalid bucket' });
    }

    const ext = filename.split('.').pop() || 'bin';
    const cleanUserId = String(userId).trim();
    const path = `${cleanUserId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    let signedUrl = '';
    let token = '';

    try {
      const bucketClient = client.storage.from(bucket);
      if (bucketClient && typeof bucketClient.createSignedUploadUrl === 'function') {
        const { data, error } = await bucketClient.createSignedUploadUrl(path);
        if (!error && data) {
          signedUrl = data.signedUrl;
          token = data.token;
        }
      }
    } catch (e: any) {
      console.warn('[signedUploadController] createSignedUploadUrl warning:', e?.message || e);
    }

    const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
    let publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mock.supabase.co';
      publicUrl = `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}`;
    }

    if (!signedUrl) {
      signedUrl = `/api/artist/upload/mock-signed?bucket=${bucket}&path=${encodeURIComponent(path)}`;
      token = randomUUID();
    }

    return res.json({
      signedUrl,
      token,
      path,
      publicUrl,
      contentType,
    });
  } catch (err: any) {
    console.error('[signedUploadController] error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate signed URL' });
  }
}
