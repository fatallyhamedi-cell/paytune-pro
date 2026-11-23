import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { authenticate } from '../middleware/auth';
import { cacheService } from '../services/cacheService';
import { validateUploadedMedia, deleteStorageObject, MediaCategory } from '../utils/uploadValidation';

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const generalMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

function wrapMulterAny(uploader: multer.Multer) {
  const middleware = uploader.any();
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: err.message || 'Upload validation failed', code: err.code });
      }
      return res.status(400).json({ error: err.message || 'Upload parsing failed' });
    });
  };
}

function pickUploadedFile(req: Request, preferredNames: string[]): Express.Multer.File | undefined {
  if (req.file) return req.file;
  const files = req.files;
  if (Array.isArray(files)) {
    for (const name of preferredNames) {
      const found = files.find((f) => f.fieldname === name);
      if (found) return found;
    }
    return files[0];
  }
  if (files && typeof files === 'object') {
    for (const name of preferredNames) {
      const arr = (files as Record<string, Express.Multer.File[]>)[name];
      if (arr?.[0]) return arr[0];
    }
  }
  return undefined;
}

async function ensurePublicBucket(client: typeof supabaseAdmin, bucketName: string) {
  try {
    const { data: existing } = await client.storage.getBucket(bucketName);
    if (!existing) {
      await client.storage.createBucket(bucketName, { public: true });
    }
  } catch {
    // Bucket already provisioned or managed externally
  }
}

async function processFileUpload(
  file: Express.Multer.File,
  bucketName: string,
  prefix: string
): Promise<{ url: string; storagePath: string; bucket: string; size: number; mime: string; originalName: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase Storage is not configured. Configure Supabase environment variables to upload media.');
  }

  const ext =
    path.extname(file.originalname).toLowerCase() ||
    (bucketName === 'audio' ? '.mp3' : bucketName === 'videos' ? '.mp4' : '.jpg');
  const safeBase = path
    .basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30) || 'media';
  const fileName = `${prefix}-${safeBase}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;

  const client = rawSupabaseAdmin || supabaseAdmin;
  await ensurePublicBucket(client, bucketName);

  const { data, error } = await client.storage.from(bucketName).upload(fileName, file.buffer, {
    contentType:
      file.mimetype ||
      (bucketName === 'audio' ? 'audio/mpeg' : bucketName === 'videos' ? 'video/mp4' : 'image/jpeg'),
    upsert: true,
  });

  if (error || !data) {
    throw new Error(error?.message || `Failed to upload file to Supabase Storage bucket '${bucketName}'.`);
  }

  const { data: publicData } = client.storage.from(bucketName).getPublicUrl(fileName);
  if (!publicData?.publicUrl) {
    throw new Error(`Unable to resolve public URL for uploaded object in '${bucketName}'.`);
  }

  return {
    url: publicData.publicUrl,
    storagePath: data.path || fileName,
    bucket: bucketName,
    size: file.size,
    mime: file.mimetype,
    originalName: file.originalname,
  };
}

async function logMediaAsset(asset: {
  userId?: string;
  assetType: 'avatar' | 'banner' | 'artwork' | 'audio' | 'video' | 'image' | 'caption';
  bucket: string;
  storagePath: string;
  publicUrl: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  extraMeta?: Record<string, any>;
}) {
  const client = rawSupabaseAdmin || supabaseAdmin;
  if (!client || !asset.userId) return null;

  const purposeMap: Record<string, string> = {
    avatar: 'artist_avatar',
    banner: 'artist_banner',
    artwork: 'album_artwork',
    audio: 'music_source',
    video: 'video_source',
    caption: 'subtitle_file',
    image: 'other',
  };

  const kindMap: Record<string, string> = {
    audio: 'audio',
    video: 'video',
    caption: 'subtitle',
  };

  try {
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('media_assets')
      .insert({
        owner_user_id: asset.userId,
        uploaded_by_user_id: asset.userId,
        original_file_name: asset.originalName,
        file_extension: path.extname(asset.originalName).replace('.', '') || null,
        mime_type: asset.mimeType || 'application/octet-stream',
        media_kind: kindMap[asset.assetType] || 'image',
        media_purpose: purposeMap[asset.assetType] || 'other',
        storage_provider: 'supabase',
        storage_bucket: asset.bucket,
        storage_path: asset.storagePath,
        file_size_bytes: asset.fileSize,
        processing_status: 'completed',
        metadata: { public_url: asset.publicUrl, ...(asset.extraMeta || {}) },
        uploaded_at: now,
        processing_completed_at: now,
      })
      .select('*')
      .maybeSingle();
    if (error) {
      console.warn('Error persisting media_assets metadata:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Error persisting media_assets metadata:', err);
    return null;
  }
}

// Root authenticated media upload endpoint: POST /api/upload and POST /api/artist/upload
router.post(
  '/',
  authenticate,
  wrapMulterAny(generalMediaUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['file', 'video', 'media', 'audio', 'image', 'thumbnail', 'avatar', 'banner', 'artwork']);
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({ error: 'Supabase Storage is not configured.' });
    }

    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { title, description = '', contentType, bucket: requestedBucket, category, isPaid, price, is_free, price_rwf } = req.body;
      const mime = String(file.mimetype || '').toLowerCase();

      let bucketName = String(requestedBucket || '').trim().toLowerCase();
      let assetType: 'avatar' | 'banner' | 'artwork' | 'audio' | 'video' | 'image' | 'caption' = 'image';
      let validationCat: MediaCategory = 'image';

      if (mime.startsWith('video/') || contentType === 'video' || contentType === 'short') {
        bucketName = bucketName || 'videos';
        assetType = 'video';
        validationCat = 'video';
      } else if (mime.startsWith('audio/') || contentType === 'audio') {
        bucketName = bucketName || 'audio';
        assetType = 'audio';
        validationCat = 'audio';
      } else if (contentType === 'caption' || /\.(vtt|srt)$/i.test(file.originalname || '')) {
        bucketName = bucketName || 'media_assets';
        assetType = 'caption';
        validationCat = 'caption';
      } else {
        const requested = bucketName || 'avatars';
        assetType = requested === 'artwork' ? 'artwork' : requested === 'banners' ? 'banner' : 'image';
        bucketName = requested === 'artwork' ? 'thumbnails' : requested;
        validationCat = 'image';
      }

      const check = validateUploadedMedia(file, validationCat);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid uploaded media file' });
      }

      const result = await processFileUpload(file, bucketName, userId.slice(0, 12));

      const mediaAsset = await logMediaAsset({
        userId,
        assetType,
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: result.mime,
        extraMeta: {
          title: title || null,
          description: description || null,
          content_type: contentType || assetType,
          is_paid: isPaid === 'true' || isPaid === true || is_free === 'false',
          price: Number(price || price_rwf || 0),
        },
      });

      let videoRecord: any = null;
      if (assetType === 'video' && title && String(title).trim()) {
        const db = rawSupabaseAdmin || supabaseAdmin;
        const { data: channel } = await db
          .from('creator_channels')
          .select('id, channel_name')
          .or(`owner_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
          .limit(1)
          .maybeSingle();

        const { data: artistProfile } = await db
          .from('artist_profiles')
          .select('id, artist_name')
          .or(`primary_contact_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
          .limit(1)
          .maybeSingle();

        if (channel && mediaAsset?.id) {
          const isShort = contentType === 'short';
          const paidFlag = !isShort && (isPaid === 'true' || isPaid === true || is_free === 'false');
          const resolvedPriceRwf = paidFlag ? Number(price || price_rwf || 0) : 0;
          const now = new Date().toISOString();
          const slug = `${String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'video'}-${crypto.randomBytes(3).toString('hex')}`;

          const { data: insertedVid, error: vidInsertErr } = await db
            .from('videos')
            .insert({
              creator_channel_id: channel.id,
              artist_profile_id: artistProfile?.id || null,
              created_by_user_id: userId,
              video_type: isShort ? 'short' : 'regular',
              title: String(title).trim(),
              description: description || null,
              slug,
              source_media_asset_id: mediaAsset.id,
              visibility: 'public',
              publication_status: 'published',
              processing_status: 'completed',
              moderation_status: 'approved',
              is_free: !paidFlag,
              is_paywalled: paidFlag,
              published_at: now,
              metadata: {
                video_url: result.url,
                preview_url: result.url,
                thumbnail_url: result.url,
                category: isShort ? 'Shorts' : category || 'Music',
                price_rwf: resolvedPriceRwf,
                price_usd: resolvedPriceRwf > 0 ? Number((resolvedPriceRwf / 1400).toFixed(2)) : 0,
                artist_id: artistProfile?.id || channel.id,
                artist_name: artistProfile?.artist_name || channel.channel_name,
                views: 0,
                view_count: 0,
                likes: 0,
                like_count: 0,
              },
            })
            .select('*')
            .maybeSingle();

          if (vidInsertErr) {
            await deleteStorageObject(db, result.url, result.bucket);
            throw new Error(vidInsertErr.message || 'Failed to save video database record');
          }

          videoRecord = insertedVid || null;
          if (videoRecord) {
            await Promise.all([
              cacheService.del('paytune:videos:trending'),
              cacheService.del('paytune:videos:new'),
              cacheService.del('paytune:videos:catalog:all'),
            ]);
          }
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Upload successful',
        url: result.url,
        publicUrl: result.url,
        bucket: result.bucket,
        path: result.storagePath,
        file: {
          path: result.storagePath,
          bucket: result.bucket,
          original_name: result.originalName,
          mime_type: result.mime,
          size: result.size,
          url: result.url,
        },
        media: mediaAsset,
        video: videoRecord,
      });
    } catch (err: any) {
      console.error('Upload route error:', err);
      return res.status(500).json({ error: err.message || 'Upload failed.' });
    }
  }
);

async function resolveOwnedArtist(user: any, requestedArtistId?: string) {
  const client = rawSupabaseAdmin || supabaseAdmin;
  if (!client || !user?.id) return null;

  const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user.role || ''));
  const targetId = requestedArtistId || user.artistId;

  if (targetId && !isPrivileged) {
    const { data: owned } = await client
      .from('artist_profiles')
      .select('id, created_by_user_id, primary_contact_user_id')
      .eq('id', targetId)
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();
    if (owned) return owned;
  }

  if (targetId && isPrivileged) {
    const { data: adminTarget } = await client
      .from('artist_profiles')
      .select('id, created_by_user_id, primary_contact_user_id')
      .or(`id.eq.${targetId},created_by_user_id.eq.${targetId},primary_contact_user_id.eq.${targetId}`)
      .limit(1)
      .maybeSingle();
    if (adminTarget) return adminTarget;
  }

  const { data: selfArtist } = await client
    .from('artist_profiles')
    .select('id, created_by_user_id, primary_contact_user_id')
    .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  if (requestedArtistId && !isPrivileged && selfArtist && selfArtist.id !== requestedArtistId && requestedArtistId !== user.id) {
    return null;
  }

  return selfArtist || null;
}

router.post(
  '/avatar',
  authenticate,
  wrapMulterAny(imageUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['avatar', 'file', 'image']);
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const requestedArtistId = req.body.artist_id ? String(req.body.artist_id) : undefined;
      const ownedArtist = await resolveOwnedArtist(user, requestedArtistId);
      if (requestedArtistId && !ownedArtist) {
        return res.status(403).json({ error: 'Unauthorized to modify this artist profile' });
      }

      const check = validateUploadedMedia(file, 'image');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid avatar image file' });
      }

      const result = await processFileUpload(file, 'avatars', user.id.slice(0, 12));

      const avatarAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'avatar',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
      });

      const client = rawSupabaseAdmin || supabaseAdmin;
      const now = new Date().toISOString();
      if (client) {
        if (ownedArtist) {
          await client
            .from('artist_profiles')
            .update({ avatar_path: result.url, updated_at: now })
            .eq('id', ownedArtist.id);
        }
        await client
          .from('creator_channels')
          .update({ avatar_path: result.url, updated_at: now })
          .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`);
        await client
          .from('profiles')
          .update({ avatar_storage_path: result.url, updated_at: now })
          .eq('user_id', user.id);
      }

      await Promise.all([
        cacheService.del('paytune:videos:trending'),
        cacheService.del('paytune:videos:new'),
        cacheService.del('paytune:videos:catalog:all'),
        cacheService.del('paytune:music:tracks:all:v2'),
      ]);

      res.json({ success: true, url: result.url, mediaAssetId: avatarAsset?.id || null });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload avatar.' });
    }
  }
);

router.post(
  '/banner',
  authenticate,
  wrapMulterAny(imageUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['banner', 'file', 'image']);
    if (!file) {
      return res.status(400).json({ error: 'No banner image file provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const requestedArtistId = req.body.artist_id ? String(req.body.artist_id) : undefined;
      const ownedArtist = await resolveOwnedArtist(user, requestedArtistId);
      if (requestedArtistId && !ownedArtist) {
        return res.status(403).json({ error: 'Unauthorized to modify this artist banner' });
      }

      const check = validateUploadedMedia(file, 'image');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid banner image file' });
      }

      const placement = String(req.body.placement || 'channel_cover');
      const result = await processFileUpload(file, 'banners', user.id.slice(0, 12));
      const focalX = req.body.focal_x != null ? Number(req.body.focal_x) : 50;
      const focalY = req.body.focal_y != null ? Number(req.body.focal_y) : 50;
      const zoom = req.body.zoom != null ? Number(req.body.zoom) : 1;

      const bannerAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'banner',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
        extraMeta: { focal_x: focalX, focal_y: focalY, zoom, placement },
      });

      const client = rawSupabaseAdmin || supabaseAdmin;
      const now = new Date().toISOString();
      if (client && placement !== 'promo_banner' && placement !== 'ad_banner') {
        if (ownedArtist) {
          await client
            .from('artist_profiles')
            .update({ banner_path: result.url, updated_at: now })
            .eq('id', ownedArtist.id);
        }
        await client
          .from('creator_channels')
          .update({ banner_path: result.url, updated_at: now })
          .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`);
      }

      res.json({
        success: true,
        url: result.url,
        mediaAssetId: bannerAsset?.id || null,
        placement,
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

router.post('/banner-coordinates', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { artist_id, focal_x, focal_y, zoom } = req.body;
    const ownedArtist = await resolveOwnedArtist(user, artist_id ? String(artist_id) : undefined);

    if (!ownedArtist) {
      return res.status(403).json({ success: false, message: 'Unauthorized or artist profile not found' });
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    const now = new Date().toISOString();
    const coords = {
      focal_x: Number(focal_x ?? 50),
      focal_y: Number(focal_y ?? 50),
      zoom: Number(zoom ?? 1),
    };

    await client
      .from('artist_profiles')
      .update({ updated_at: now })
      .eq('id', ownedArtist.id);

    // Persist latest banner crop coordinates in the user's latest banner media_asset metadata
    const { data: latestBanner } = await client
      .from('media_assets')
      .select('id, metadata')
      .eq('owner_user_id', ownedArtist.created_by_user_id)
      .eq('media_purpose', 'artist_banner')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestBanner?.id) {
      const prevMeta = (latestBanner.metadata && typeof latestBanner.metadata === 'object' ? latestBanner.metadata : {}) as Record<string, any>;
      await client
        .from('media_assets')
        .update({ metadata: { ...prevMeta, ...coords } })
        .eq('id', latestBanner.id);
    }

    return res.json({
      success: true,
      message: 'Banner focal coordinates saved',
      ...coords,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post(
  '/audio',
  authenticate,
  wrapMulterAny(audioUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['audio', 'file', 'media']);
    if (!file) {
      return res.status(400).json({ error: 'No audio track file provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

      const check = validateUploadedMedia(file, 'audio');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid audio file' });
      }

      const result = await processFileUpload(file, 'audio', user.id.slice(0, 12));
      const trackTitle = req.body.title || path.basename(file.originalname, path.extname(file.originalname));

      const mediaAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'audio',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
      });

      res.json({
        success: true,
        url: result.url,
        mediaAssetId: mediaAsset?.id || null,
        original_name: result.originalName,
        size_bytes: result.size,
        mime_type: check.detectedType || result.mime,
        title: trackTitle,
      });
    } catch (err: any) {
      console.error('Audio upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload audio.' });
    }
  }
);

router.post(
  '/artwork',
  authenticate,
  wrapMulterAny(imageUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['artwork', 'file', 'image']);
    if (!file) {
      return res.status(400).json({ error: 'No artwork image provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

      const check = validateUploadedMedia(file, 'image');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid artwork image file' });
      }

      const result = await processFileUpload(file, 'thumbnails', user.id.slice(0, 12));

      const mediaAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'artwork',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
      });

      res.json({ success: true, url: result.url, mediaAssetId: mediaAsset?.id || null });
    } catch (err: any) {
      console.error('Artwork upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload artwork.' });
    }
  }
);

router.post(
  '/image',
  authenticate,
  wrapMulterAny(imageUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['image', 'file', 'avatar']);
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

      const check = validateUploadedMedia(file, 'image');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid image file' });
      }

      const result = await processFileUpload(file, 'avatars', user.id.slice(0, 12));
      const mediaAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'image',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
      });

      res.json({ success: true, url: result.url, mediaAssetId: mediaAsset?.id || null });
    } catch (err: any) {
      console.error('Image upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload image.' });
    }
  }
);

router.post(
  '/caption',
  authenticate,
  wrapMulterAny(imageUpload),
  async (req: Request, res: Response) => {
    const file = pickUploadedFile(req, ['caption', 'subtitle', 'file']);
    if (!file) {
      return res.status(400).json({ error: 'No subtitle/caption file (.vtt or .srt) provided.' });
    }

    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

      const check = validateUploadedMedia(file, 'caption');
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid caption file. Upload .vtt or .srt.' });
      }

      const result = await processFileUpload(file, 'media_assets', `sub-${user.id.slice(0, 12)}`);
      const mediaAsset = await logMediaAsset({
        userId: user.id,
        assetType: 'caption',
        bucket: result.bucket,
        storagePath: result.storagePath,
        publicUrl: result.url,
        originalName: result.originalName,
        fileSize: result.size,
        mimeType: check.detectedType || result.mime,
      });

      res.status(201).json({
        success: true,
        url: result.url,
        mediaAssetId: mediaAsset?.id || null,
        original_name: result.originalName,
        mime_type: check.detectedType || result.mime,
      });
    } catch (err: any) {
      console.error('Caption upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload caption file.' });
    }
  }
);

export default router;
