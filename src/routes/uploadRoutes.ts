import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { optionalAuthenticate } from '../middleware/auth';
import { getDbStore, notifyMutation } from '../config/supabase_mock';

const router = Router();

// Image upload limiter: 15 MB
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Audio upload limiter: 100 MB
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const ensureUploadsDir = (subdir?: string) => {
  const baseDir = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';
  const uploadsDir = subdir ? path.join(baseDir, 'public', 'uploads', subdir) : path.join(baseDir, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

/**
 * Common upload processor:
 * 1. Tries Supabase Storage bucket ('avatars', 'banners', 'audio', 'artwork')
 * 2. Falls back to local public directory /uploads/
 */
async function processFileUpload(
  file: Express.Multer.File,
  bucketName: string,
  prefix: string,
  subdir: string = ''
): Promise<{ url: string; size: number; mime: string; originalName: string }> {
  const ext = path.extname(file.originalname).toLowerCase() || (bucketName === 'audio' ? '.mp3' : '.jpg');
  const safeBase = path
    .basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30);
  const fileName = `${prefix}-${safeBase}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;

  // 1. Try Supabase Storage
  if (isSupabaseConfigured()) {
    try {
      try {
        await supabaseAdmin.storage.createBucket(bucketName, { public: true });
      } catch {
        // Bucket may already exist
      }

      const { data, error } = await supabaseAdmin.storage.from(bucketName).upload(fileName, file.buffer, {
        contentType: file.mimetype || (bucketName === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
        upsert: true,
      });

      if (!error && data) {
        const { data: publicData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          return {
            url: publicData.publicUrl,
            size: file.size,
            mime: file.mimetype,
            originalName: file.originalname,
          };
        }
      }
    } catch (sbError) {
      console.warn(`Supabase storage upload to '${bucketName}' notice:`, sbError);
    }
  }

  // 2. Fallback: Save to local public/uploads directory
  try {
    const targetDir = ensureUploadsDir(subdir);
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    const webPath = subdir ? `/uploads/${subdir}/${fileName}` : `/uploads/${fileName}`;
    return {
      url: webPath,
      size: file.size,
      mime: file.mimetype,
      originalName: file.originalname,
    };
  } catch (fsErr) {
    console.warn('Local filesystem write notice, falling back to data URL:', fsErr);
    // 3. Fallback: Return base64 data URI
    return {
      url: `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`,
      size: file.size,
      mime: file.mimetype,
      originalName: file.originalname,
    };
  }
}

// Record asset into database registry
function logMediaAsset(asset: {
  userId?: string;
  artistId?: string;
  assetType: 'avatar' | 'banner' | 'artwork' | 'audio' | 'video' | 'image';
  url: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  metadata?: any;
}) {
  try {
    const store = getDbStore();
    if (!store.media_assets) store.media_assets = [];
    store.media_assets.push({
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: asset.userId || null,
      artist_id: asset.artistId || null,
      asset_type: asset.assetType,
      url: asset.url,
      original_name: asset.originalName,
      file_size: asset.fileSize,
      mime_type: asset.mimeType,
      metadata: asset.metadata || {},
      created_at: new Date().toISOString(),
    });
    notifyMutation();
  } catch (err) {
    console.warn('Error recording media asset:', err);
  }
}

// ==========================================
// 1. AVATAR UPLOAD (Square 1:1, max 10MB)
// ==========================================
router.post(
  '/avatar',
  optionalAuthenticate,
  imageUpload.single('avatar'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const result = await processFileUpload(file, 'avatars', 'avatar', 'avatars');
      const user = (req as any).user;

      logMediaAsset({
        userId: user?.id,
        artistId: req.body.artist_id || user?.id,
        assetType: 'avatar',
        url: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: result.mime,
      });

      // Update artist or user profile in store if present
      const store = getDbStore();
      const artistId = req.body.artist_id || user?.id;
      if (artistId && store.artists) {
        const artist = store.artists.find(
          (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
        );
        if (artist) {
          artist.avatar_url = result.url;
          artist.profile_image = result.url;
          artist.updated_at = new Date().toISOString();
          notifyMutation();
        }
      }

      res.json({ success: true, url: result.url });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload avatar.' });
    }
  }
);

// ==========================================
// 2. YOUTUBE-STYLE BANNER UPLOAD & FOCAL COORDS
// (2560x1440 16:9 canvas, safe zone 1546x423)
// ==========================================
router.post(
  '/banner',
  optionalAuthenticate,
  imageUpload.single('banner'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No banner image file provided.' });
    }

    try {
      const result = await processFileUpload(file, 'banners', 'banner', 'banners');
      const user = (req as any).user;
      const focalX = req.body.focal_x != null ? Number(req.body.focal_x) : 50;
      const focalY = req.body.focal_y != null ? Number(req.body.focal_y) : 50;
      const zoom = req.body.zoom != null ? Number(req.body.zoom) : 1;
      const artistId = req.body.artist_id || user?.id;

      const store = getDbStore();
      if (!store.profile_covers) store.profile_covers = [];
      store.profile_covers.push({
        id: `cover-${Date.now()}`,
        user_id: user?.id || null,
        artist_id: artistId || null,
        banner_url: result.url,
        focal_x: focalX,
        focal_y: focalY,
        zoom: zoom,
        safe_zone: { width: 1546, height: 423, canvas_width: 2560, canvas_height: 1440 },
        created_at: new Date().toISOString(),
      });

      if (artistId && store.artists) {
        const artist = store.artists.find(
          (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
        );
        if (artist) {
          artist.banner_url = result.url;
          artist.banner_image = result.url;
          artist.banner_focal_x = focalX;
          artist.banner_focal_y = focalY;
          artist.banner_zoom = zoom;
          artist.updated_at = new Date().toISOString();
        }
      }

      logMediaAsset({
        userId: user?.id,
        artistId,
        assetType: 'banner',
        url: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: result.mime,
        metadata: { focal_x: focalX, focal_y: focalY, zoom },
      });

      notifyMutation();

      res.json({
        success: true,
        url: result.url,
        focal_x: focalX,
        focal_y: focalY,
        zoom,
        canvas: { width: 2560, height: 1440 },
        safe_area: { width: 1546, height: 423 },
      });
    } catch (err: any) {
      console.error('Banner upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload banner.' });
    }
  }
);

// Update banner focal coordinates without re-uploading image
router.post('/banner-coordinates', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { artist_id, focal_x, focal_y, zoom } = req.body;
    const artistId = artist_id || user?.id;

    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier required' });
    }

    const store = getDbStore();
    const artist = (store.artists || []).find(
      (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
    );

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    artist.banner_focal_x = Number(focal_x ?? 50);
    artist.banner_focal_y = Number(focal_y ?? 50);
    artist.banner_zoom = Number(zoom ?? 1);
    artist.updated_at = new Date().toISOString();

    notifyMutation();

    return res.json({
      success: true,
      message: 'Banner focal coordinates updated successfully',
      focal_x: artist.banner_focal_x,
      focal_y: artist.banner_focal_y,
      zoom: artist.banner_zoom,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. AUDIO / MUSIC TRACK UPLOAD (MP3, WAV, FLAC, AAC)
// ==========================================
router.post(
  '/audio',
  optionalAuthenticate,
  audioUpload.single('audio'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.audio?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No audio track file provided.' });
    }

    try {
      const result = await processFileUpload(file, 'audio', 'track', 'audio');
      const user = (req as any).user;
      const artistId = req.body.artist_id || user?.id;
      const trackTitle = req.body.title || path.basename(file.originalname, path.extname(file.originalname));

      logMediaAsset({
        userId: user?.id,
        artistId,
        assetType: 'audio',
        url: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: result.mime,
        metadata: {
          title: trackTitle,
          genre: req.body.genre || 'Afrobeats',
          isrc: req.body.isrc || null,
        },
      });

      res.json({
        success: true,
        url: result.url,
        original_name: result.originalName,
        size_bytes: result.size,
        mime_type: result.mime,
        title: trackTitle,
      });
    } catch (err: any) {
      console.error('Audio upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload audio.' });
    }
  }
);

// ==========================================
// 4. ARTWORK / ALBUM COVER UPLOAD (1:1 Aspect Ratio)
// ==========================================
router.post(
  '/artwork',
  optionalAuthenticate,
  imageUpload.single('artwork'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.artwork?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No artwork image provided.' });
    }

    try {
      const result = await processFileUpload(file, 'artwork', 'art', 'artwork');
      const user = (req as any).user;

      logMediaAsset({
        userId: user?.id,
        artistId: req.body.artist_id || user?.id,
        assetType: 'artwork',
        url: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: result.mime,
      });

      res.json({ success: true, url: result.url });
    } catch (err: any) {
      console.error('Artwork upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload artwork.' });
    }
  }
);

// ==========================================
// 5. GENERIC IMAGE UPLOAD
// ==========================================
router.post(
  '/image',
  optionalAuthenticate,
  imageUpload.single('image'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const result = await processFileUpload(file, 'avatars', 'img', 'images');
      res.json({ success: true, url: result.url });
    } catch (err: any) {
      console.error('Image upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload image.' });
    }
  }
);

export default router;
