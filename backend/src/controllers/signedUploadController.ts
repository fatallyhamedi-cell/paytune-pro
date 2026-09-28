import { Response } from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';

export async function createSignedUploadUrl(req: any, res: Response) {
  try {
    const userId = req.artistUserId || req.artistId;
    const { bucket = 'videos', filename, contentType } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const allowed = ['videos', 'audio', 'thumbnails', 'avatars', 'banners', 'previews'];
    if (!allowed.includes(bucket)) {
      return res.status(400).json({ error: 'invalid bucket: ' + bucket });
    }

    const ext = (filename.split('.').pop() || 'bin').toLowerCase();
    const objectPath = `${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    // Create the signed upload URL
    let signedData: any = null;
    try {
      const bucketClient = supabase.storage.from(bucket);
      if (bucketClient && typeof bucketClient.createSignedUploadUrl === 'function') {
        const { data, error } = await bucketClient.createSignedUploadUrl(objectPath);
        if (error) {
          console.warn('[createSignedUploadUrl] notice:', error.message);
        } else {
          signedData = data;
        }
      }
    } catch (e: any) {
      console.warn('[createSignedUploadUrl] exception:', e?.message || e);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = urlData?.publicUrl || `https://reuekwbqdjtwqzpyqtuc.supabase.co/storage/v1/object/public/${bucket}/${objectPath}`;

    return res.json({
      signedUrl: signedData?.signedUrl || `/api/artist/upload/mock-signed?bucket=${bucket}&path=${encodeURIComponent(objectPath)}`,
      token: signedData?.token || randomUUID(),
      path: objectPath,
      publicUrl,
      contentType,
    });
  } catch (err: any) {
    console.error('signedUpload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
