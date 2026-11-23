import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { processAndUploadVideo } from '../services/videoService';
import { contentIdService } from '../services/contentIdService';
import { notifySubscribersNewVideo } from '../services/notificationService';
import { cacheService } from '../services/cacheService';
import { validateUploadedMedia, deleteStorageObjects } from '../utils/uploadValidation';

const getDb = () => rawSupabaseAdmin || supabaseAdmin;

async function resolveAuthenticatedCreator(req: Request) {
  const db = getDb();
  const reqArtistId = (req as any).artistId;
  const user = (req as any).user;
  const userId = user?.id || null;
  const lookupIds = [reqArtistId, user?.artistId, userId].filter(Boolean);

  if (!userId && lookupIds.length === 0) return null;

  let artistProfile: any = null;
  let creatorChannel: any = null;

  for (const candidateId of lookupIds) {
    if (!artistProfile) {
      const { data: apById } = await db
        .from('artist_profiles')
        .select('*')
        .eq('id', candidateId)
        .maybeSingle();
      if (apById) artistProfile = apById;
    }

    if (!creatorChannel) {
      const { data: chById } = await db
        .from('creator_channels')
        .select('*')
        .eq('id', candidateId)
        .maybeSingle();
      if (chById) creatorChannel = chById;
    }
  }

  if (userId && !artistProfile) {
    const { data: apByOwner } = await db
      .from('artist_profiles')
      .select('*')
      .or(`primary_contact_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    if (apByOwner) artistProfile = apByOwner;
  }

  if (userId && !creatorChannel) {
    const { data: chByOwner } = await db
      .from('creator_channels')
      .select('*')
      .or(`owner_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    if (chByOwner) creatorChannel = chByOwner;
  }

  if (!creatorChannel && artistProfile) {
    const ownerId = artistProfile.primary_contact_user_id || artistProfile.created_by_user_id || userId;
    if (ownerId) {
      const { data: chByOwner } = await db
        .from('creator_channels')
        .select('*')
        .eq('owner_user_id', ownerId)
        .limit(1)
        .maybeSingle();
      if (chByOwner) creatorChannel = chByOwner;
    }
  }

  if (!artistProfile && creatorChannel) {
    const { data: apByOwner } = await db
      .from('artist_profiles')
      .select('*')
      .or(`primary_contact_user_id.eq.${creatorChannel.owner_user_id},created_by_user_id.eq.${creatorChannel.created_by_user_id}`)
      .limit(1)
      .maybeSingle();
    if (apByOwner) artistProfile = apByOwner;
  }

  if (!artistProfile && !creatorChannel) return null;

  const ownerUserId =
    creatorChannel?.owner_user_id ||
    artistProfile?.primary_contact_user_id ||
    artistProfile?.created_by_user_id ||
    userId;

  if (!creatorChannel && artistProfile && ownerUserId) {
    const handle = `${artistProfile.artist_handle || 'channel'}-${crypto.randomBytes(2).toString('hex')}`;
    const { data: createdChannel } = await db
      .from('creator_channels')
      .insert({
        channel_name: artistProfile.artist_name,
        channel_handle: handle,
        channel_type: 'individual',
        avatar_path: artistProfile.avatar_path,
        banner_path: artistProfile.banner_path,
        country_code: artistProfile.country_code || 'RW',
        owner_user_id: ownerUserId,
        created_by_user_id: ownerUserId,
        approval_status: artistProfile.approval_status || 'pending',
        verification_status: artistProfile.verification_status || 'not_submitted',
        record_status: artistProfile.record_status || 'active',
      })
      .select('*')
      .single();
    creatorChannel = createdChannel;
  }

  return {
    artistProfile,
    creatorChannel,
    ownerUserId,
    artistId: artistProfile?.id || creatorChannel?.id,
    channelId: creatorChannel?.id,
    displayName: artistProfile?.artist_name || creatorChannel?.channel_name || 'Creator',
    approvalStatus: artistProfile?.approval_status || creatorChannel?.approval_status || 'pending',
    recordStatus: artistProfile?.record_status || creatorChannel?.record_status || 'active',
  };
}

function slugifyTitle(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return `${base || 'video'}-${crypto.randomBytes(3).toString('hex')}`;
}

export const uploadVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database and storage are not configured.' });
  }

  try {
    const creator = await resolveAuthenticatedCreator(req);
    if (!creator || !creator.ownerUserId || !creator.channelId) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    if (creator.approvalStatus === 'rejected') {
      return res.status(403).json({ error: 'Artist account is rejected' });
    }
    if (creator.recordStatus === 'suspended') {
      return res.status(403).json({ error: 'Artist account is currently suspended' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const videoFile = files?.video?.[0] || files?.file?.[0] || files?.media?.[0];
    const thumbnailFile = files?.thumbnail?.[0] || files?.image?.[0];

    if (!videoFile) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    const {
      title,
      description = '',
      category,
      price_rwf,
      price_usd,
      is_free,
      is_short,
      visibility = 'public',
      publication_status,
      scheduled_release,
      scheduled_at,
      chapters,
      tags,
      language_code,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const vidCheck = validateUploadedMedia(videoFile, 'video');
    if (!vidCheck.valid) {
      return res.status(400).json({ error: vidCheck.error || 'Invalid video file' });
    }
    if (thumbnailFile) {
      const thumbCheck = validateUploadedMedia(thumbnailFile, 'image');
      if (!thumbCheck.valid) {
        return res.status(400).json({ error: thumbCheck.error || 'Invalid thumbnail image file' });
      }
    }

    const isFree = is_free === 'true' || is_free === true;
    const isShort = is_short === 'true' || is_short === true;

    if (!isFree && !isShort) {
      if (!price_rwf || Number(price_rwf) < 200) {
        return res.status(400).json({ error: 'RWF price must be at least 200' });
      }
      if (!price_usd || Number(price_usd) < 1) {
        return res.status(400).json({ error: 'USD price must be at least 1' });
      }
    }

    const { video_url, preview_url, thumbnail_url, duration } = await processAndUploadVideo({
      videoBuffer: videoFile.buffer,
      thumbnailBuffer: thumbnailFile ? thumbnailFile.buffer : null,
      originalName: videoFile.originalname,
      artistId: creator.artistId,
      metadata: { is_short: isShort },
    });

    const db = getDb();
    const now = new Date().toISOString();

    const extractBucketPath = (url: string, bucket: string) => {
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      return idx >= 0 ? url.slice(idx + marker.length) : url;
    };

    const uploadedObjectsForRollback = [
      { bucket: 'videos', url: video_url },
      preview_url ? { bucket: 'previews', url: preview_url } : null,
      thumbnail_url && thumbnail_url !== video_url ? { bucket: 'thumbnails', url: thumbnail_url } : null,
    ].filter(Boolean) as Array<{ bucket: string; url: string }>;

    const { data: videoAsset, error: vAssetErr } = await db
      .from('media_assets')
      .insert({
        owner_user_id: creator.ownerUserId,
        uploaded_by_user_id: creator.ownerUserId,
        original_file_name: videoFile.originalname,
        file_extension: path.extname(videoFile.originalname).replace('.', '') || 'mp4',
        mime_type: vidCheck.detectedType || videoFile.mimetype || 'video/mp4',
        media_kind: 'video',
        media_purpose: isShort ? 'short_source' : 'video_source',
        storage_provider: 'supabase',
        storage_bucket: 'videos',
        storage_path: extractBucketPath(video_url, 'videos'),
        file_size_bytes: videoFile.size,
        duration_seconds: duration || null,
        processing_status: 'completed',
        metadata: { public_url: video_url, preview_url },
        uploaded_at: now,
        processing_completed_at: now,
      })
      .select('id')
      .single();

    if (vAssetErr || !videoAsset) {
      await deleteStorageObjects(db, uploadedObjectsForRollback);
      return res.status(500).json({ error: vAssetErr?.message || 'Failed to register video media asset' });
    }

    let thumbnailAssetId: string | null = null;
    if (thumbnail_url) {
      const { data: tAsset } = await db
        .from('media_assets')
        .insert({
          owner_user_id: creator.ownerUserId,
          uploaded_by_user_id: creator.ownerUserId,
          original_file_name: thumbnailFile?.originalname || 'thumbnail.jpg',
          file_extension: thumbnailFile ? path.extname(thumbnailFile.originalname).replace('.', '') || 'jpg' : 'jpg',
          mime_type: thumbnailFile?.mimetype || 'image/jpeg',
          media_kind: 'image',
          media_purpose: 'video_thumbnail',
          storage_provider: 'supabase',
          storage_bucket: 'thumbnails',
          storage_path: extractBucketPath(thumbnail_url, 'thumbnails'),
          file_size_bytes: thumbnailFile?.size || null,
          processing_status: 'completed',
          metadata: { public_url: thumbnail_url },
          uploaded_at: now,
          processing_completed_at: now,
        })
        .select('id')
        .single();
      thumbnailAssetId = tAsset?.id || null;
    }

    let parsedChapters: any = null;
    if (chapters) {
      try {
        parsedChapters = typeof chapters === 'string' ? JSON.parse(chapters) : chapters;
      } catch {
        parsedChapters = null;
      }
    }

    const parsedTags = Array.isArray(tags)
      ? tags.map((t: any) => String(t).trim()).filter(Boolean)
      : typeof tags === 'string'
        ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

    const uniqueLink = visibility === 'unlisted' ? crypto.randomUUID().replace(/-/g, '') : null;
    const allowedVisibilities = new Set(['public', 'unlisted', 'private', 'members_only']);
    const normalizedVisibility = allowedVisibilities.has(String(visibility)) ? String(visibility) : 'public';
    const rawSched = scheduled_release || scheduled_at;
    const isScheduledTime = Boolean(rawSched && new Date(rawSched).getTime() > Date.now());
    const normalizedStatus =
      publication_status === 'draft'
        ? 'draft'
        : publication_status === 'scheduled' || isScheduledTime
          ? 'scheduled'
          : 'published';

    const { data: insertedVideo, error: vidErr } = await db
      .from('videos')
      .insert({
        creator_channel_id: creator.channelId,
        artist_profile_id: creator.artistProfile?.id || null,
        created_by_user_id: creator.ownerUserId,
        video_type: isShort ? 'short' : 'regular',
        title: String(title).trim(),
        description: description || null,
        slug: slugifyTitle(String(title).trim()),
        duration_seconds: duration || null,
        source_media_asset_id: videoAsset.id,
        thumbnail_media_asset_id: thumbnailAssetId,
        visibility: normalizedVisibility,
        publication_status: normalizedStatus,
        processing_status: 'completed',
        moderation_status: 'approved',
        is_free: isFree || isShort,
        is_paywalled: !(isFree || isShort),
        scheduled_at: normalizedStatus === 'scheduled' && rawSched ? new Date(rawSched).toISOString() : null,
        published_at: normalizedStatus === 'published' ? now : null,
        metadata: {
          video_url,
          preview_url,
          thumbnail_url,
          category: isShort ? 'Shorts' : category || 'Music',
          price_rwf: isFree || isShort ? 0 : Number(price_rwf),
          price_usd: isFree || isShort ? 0 : Number(price_usd),
          unique_link: uniqueLink,
          chapters: parsedChapters,
          tags: parsedTags,
          language_code: language_code || 'en',
          artist_id: creator.artistId,
          artist_name: creator.displayName,
        },
      })
      .select('*')
      .single();

    if (vidErr || !insertedVideo) {
      await deleteStorageObjects(db, uploadedObjectsForRollback);
      await db.from('media_assets').delete().in('id', [videoAsset.id, thumbnailAssetId].filter(Boolean) as string[]);
      return res.status(500).json({ error: vidErr?.message || 'Failed to save video metadata' });
    }

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del('paytune:categories:all'),
    ]);

    let contentIdScan: any = null;
    try {
      contentIdScan = await contentIdService.scanVideo({
        title: insertedVideo.title,
        description: insertedVideo.description || '',
        tags: parsedTags,
        videoUrl: video_url,
      });
    } catch (cidErr) {
      console.warn('Content ID scan notice:', cidErr);
    }

    if (normalizedStatus === 'published' && normalizedVisibility === 'public') {
      void notifySubscribersNewVideo({
        id: insertedVideo.id,
        title: insertedVideo.title,
        artist_id: creator.artistId,
        is_short: isShort,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        ...insertedVideo,
        video_url,
        preview_url,
        thumbnail_url,
        duration,
        category: insertedVideo.metadata?.category,
        price_rwf: insertedVideo.metadata?.price_rwf || 0,
        price_usd: insertedVideo.metadata?.price_usd || 0,
        is_short: isShort,
        contentIdScan,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

export const deleteVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured.' });
  }

  try {
    const creator = await resolveAuthenticatedCreator(req);
    if (!creator) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    const { id } = req.params;
    const db = getDb();

    const { data: video } = await db
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const ownsVideo =
      video.created_by_user_id === creator.ownerUserId ||
      (creator.channelId && video.creator_channel_id === creator.channelId) ||
      (creator.artistProfile?.id && video.artist_profile_id === creator.artistProfile.id);

    if (!ownsVideo) {
      return res.status(403).json({ error: 'Unauthorized to delete this video' });
    }

    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
    await deleteStorageObjects(db, [
      { bucket: 'videos', url: meta.video_url },
      { bucket: 'previews', url: meta.preview_url },
      { bucket: 'thumbnails', url: meta.thumbnail_url },
    ]);

    const { error: delErr } = await db.from('videos').delete().eq('id', id);
    if (delErr) {
      return res.status(500).json({ error: delErr.message });
    }

    const assetIds = [video.source_media_asset_id, video.thumbnail_media_asset_id].filter(Boolean);
    if (assetIds.length > 0) {
      await db.from('media_assets').delete().in('id', assetIds);
    }

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del(`paytune:videos:related:${id}`),
    ]);

    return res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message || 'Delete failed' });
  }
};

const ALLOWED_SIGNED_BUCKETS = new Set([
  'videos',
  'audio',
  'thumbnails',
  'avatars',
  'banners',
  'previews',
]);

export const createSignedUploadUrl = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database and storage are not configured.' });
  }

  try {
    const creator = await resolveAuthenticatedCreator(req);
    if (!creator || !creator.ownerUserId) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    if (creator.approvalStatus === 'rejected') {
      return res.status(403).json({ error: 'Artist account is rejected' });
    }
    if (creator.recordStatus === 'suspended') {
      return res.status(403).json({ error: 'Artist account is currently suspended' });
    }

    const rawBucket = String(req.body?.bucket || 'videos').toLowerCase().trim();
    const normalizedBucket = rawBucket === 'artwork' ? 'thumbnails' : rawBucket;
    const bucket = ALLOWED_SIGNED_BUCKETS.has(normalizedBucket) ? normalizedBucket : 'videos';
    const rawFilename = String(req.body?.filename || `media-${Date.now()}.mp4`);
    const ext = path.extname(rawFilename).toLowerCase() || (bucket === 'audio' ? '.mp3' : bucket === 'videos' ? '.mp4' : '.jpg');
    const safeBase = path
      .basename(rawFilename, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48) || 'media';

    const ownerFolder = creator.artistId || creator.ownerUserId;
    const objectPath = `${ownerFolder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeBase}${ext}`;

    const db = getDb();
    try {
      const { data: existing } = await db.storage.getBucket(bucket);
      if (!existing) {
        await db.storage.createBucket(bucket, { public: true });
      }
    } catch {
      // Bucket lookup or creation skipped if already provisioned
    }

    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (error || !data) {
      return res.status(500).json({ error: error?.message || `Failed to generate signed upload URL for '${bucket}'` });
    }

    const { data: pubData } = db.storage.from(bucket).getPublicUrl(data.path || objectPath);

    return res.json({
      success: true,
      bucket,
      path: data.path || objectPath,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: pubData?.publicUrl || '',
    });
  } catch (error: any) {
    console.error('Signed upload URL error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create signed upload URL' });
  }
};

export const completeVideoUpload = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database and storage are not configured.' });
  }

  try {
    const creator = await resolveAuthenticatedCreator(req);
    if (!creator || !creator.ownerUserId || !creator.channelId) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    if (creator.approvalStatus === 'rejected') {
      return res.status(403).json({ error: 'Artist account is rejected' });
    }
    if (creator.recordStatus === 'suspended') {
      return res.status(403).json({ error: 'Artist account is currently suspended' });
    }

    const {
      videoUrl,
      video_url,
      thumbnailUrl,
      thumbnail_url,
      previewUrl,
      preview_url,
      title,
      description = '',
      category,
      price_rwf,
      price_usd,
      is_free,
      is_short,
      media_type,
      visibility = 'public',
      publication_status,
      scheduled_release,
      scheduled_at,
      chapters,
      tags,
      duration,
      language_code,
    } = req.body;

    const resolvedVideoUrl = String(videoUrl || video_url || '').trim();
    const resolvedThumbnailUrl = thumbnailUrl || thumbnail_url ? String(thumbnailUrl || thumbnail_url).trim() : null;
    const resolvedPreviewUrl = previewUrl || preview_url ? String(previewUrl || preview_url).trim() : null;

    if (!resolvedVideoUrl) {
      return res.status(400).json({ error: 'Uploaded video URL is required' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const isShort = is_short === true || is_short === 'true' || media_type === 'short';
    const isFree = is_free === true || is_free === 'true' || isShort;

    let finalPriceRwf = 0;
    let finalPriceUsd = 0;
    if (!isFree) {
      finalPriceRwf = Number(price_rwf || 0);
      if (finalPriceRwf < 200) {
        return res.status(400).json({ error: 'RWF price must be at least 200' });
      }
      const parsedUsd = Number(price_usd || 0);
      finalPriceUsd = parsedUsd >= 1 ? parsedUsd : Number(Math.max(1, finalPriceRwf / 1400).toFixed(2));
    }

    const db = getDb();
    const now = new Date().toISOString();
    const extractBucketPath = (url: string, bucket: string) => {
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      return idx >= 0 ? url.slice(idx + marker.length) : url;
    };

    const inferredBucket = resolvedVideoUrl.includes('/object/public/audio/') ? 'audio' : 'videos';
    const inferredExt = path.extname(resolvedVideoUrl.split('?')[0]).replace('.', '') || (inferredBucket === 'audio' ? 'mp3' : 'mp4');
    const numericDuration = Number(duration) > 0 ? Math.round(Number(duration)) : null;

    const { data: videoAsset, error: vAssetErr } = await db
      .from('media_assets')
      .insert({
        owner_user_id: creator.ownerUserId,
        uploaded_by_user_id: creator.ownerUserId,
        original_file_name: `${slugifyTitle(String(title).trim())}.${inferredExt}`,
        file_extension: inferredExt,
        mime_type: inferredBucket === 'audio' ? 'audio/mpeg' : 'video/mp4',
        media_kind: inferredBucket === 'audio' ? 'audio' : 'video',
        media_purpose: isShort ? 'short_source' : inferredBucket === 'audio' ? 'music_source' : 'video_source',
        storage_provider: 'supabase',
        storage_bucket: inferredBucket,
        storage_path: extractBucketPath(resolvedVideoUrl, inferredBucket),
        duration_seconds: numericDuration,
        processing_status: 'completed',
        metadata: { public_url: resolvedVideoUrl, preview_url: resolvedPreviewUrl },
        uploaded_at: now,
        processing_completed_at: now,
      })
      .select('id')
      .single();

    if (vAssetErr || !videoAsset) {
      await deleteStorageObjects(db, [
        { bucket: inferredBucket, url: resolvedVideoUrl },
        resolvedThumbnailUrl ? { bucket: 'thumbnails', url: resolvedThumbnailUrl } : { bucket: 'thumbnails', url: null },
      ]);
      return res.status(500).json({ error: vAssetErr?.message || 'Failed to register uploaded media asset' });
    }

    let thumbnailAssetId: string | null = null;
    if (resolvedThumbnailUrl) {
      const { data: tAsset } = await db
        .from('media_assets')
        .insert({
          owner_user_id: creator.ownerUserId,
          uploaded_by_user_id: creator.ownerUserId,
          original_file_name: 'thumbnail.jpg',
          file_extension: path.extname(resolvedThumbnailUrl.split('?')[0]).replace('.', '') || 'jpg',
          mime_type: 'image/jpeg',
          media_kind: 'image',
          media_purpose: 'video_thumbnail',
          storage_provider: 'supabase',
          storage_bucket: 'thumbnails',
          storage_path: extractBucketPath(resolvedThumbnailUrl, 'thumbnails'),
          processing_status: 'completed',
          metadata: { public_url: resolvedThumbnailUrl },
          uploaded_at: now,
          processing_completed_at: now,
        })
        .select('id')
        .single();
      thumbnailAssetId = tAsset?.id || null;
    }

    let parsedChapters: any = null;
    if (chapters) {
      try {
        parsedChapters = typeof chapters === 'string' ? JSON.parse(chapters) : chapters;
      } catch {
        parsedChapters = null;
      }
    }

    const parsedTags = Array.isArray(tags)
      ? tags.map((t: any) => String(t).trim()).filter(Boolean)
      : typeof tags === 'string'
        ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

    const uniqueLink = visibility === 'unlisted' ? crypto.randomUUID().replace(/-/g, '') : null;
    const allowedVisibilities = new Set(['public', 'unlisted', 'private', 'members_only']);
    const normalizedVisibility = allowedVisibilities.has(String(visibility)) ? String(visibility) : 'public';
    const rawSched = scheduled_release || scheduled_at;
    const isScheduledTime = Boolean(rawSched && new Date(rawSched).getTime() > Date.now());
    const normalizedStatus =
      publication_status === 'draft'
        ? 'draft'
        : publication_status === 'scheduled' || isScheduledTime
          ? 'scheduled'
          : 'published';

    const { data: insertedVideo, error: vidErr } = await db
      .from('videos')
      .insert({
        creator_channel_id: creator.channelId,
        artist_profile_id: creator.artistProfile?.id || null,
        created_by_user_id: creator.ownerUserId,
        video_type: isShort ? 'short' : 'regular',
        title: String(title).trim(),
        description: description || null,
        slug: slugifyTitle(String(title).trim()),
        duration_seconds: numericDuration,
        source_media_asset_id: videoAsset.id,
        thumbnail_media_asset_id: thumbnailAssetId,
        visibility: normalizedVisibility,
        publication_status: normalizedStatus,
        processing_status: 'completed',
        moderation_status: 'approved',
        is_free: isFree,
        is_paywalled: !isFree,
        scheduled_at: normalizedStatus === 'scheduled' && rawSched ? new Date(rawSched).toISOString() : null,
        published_at: normalizedStatus === 'published' ? now : null,
        metadata: {
          video_url: resolvedVideoUrl,
          preview_url: resolvedPreviewUrl || resolvedVideoUrl,
          thumbnail_url: resolvedThumbnailUrl || resolvedVideoUrl,
          category: isShort ? 'Shorts' : category || 'Music',
          price_rwf: finalPriceRwf,
          price_usd: finalPriceUsd,
          unique_link: uniqueLink,
          chapters: parsedChapters,
          tags: parsedTags,
          language_code: language_code || 'en',
          artist_id: creator.artistId,
          artist_name: creator.displayName,
        },
      })
      .select('*')
      .single();

    if (vidErr || !insertedVideo) {
      await deleteStorageObjects(db, [
        { bucket: inferredBucket, url: resolvedVideoUrl },
        resolvedThumbnailUrl ? { bucket: 'thumbnails', url: resolvedThumbnailUrl } : { bucket: 'thumbnails', url: null },
      ]);
      await db.from('media_assets').delete().in('id', [videoAsset.id, thumbnailAssetId].filter(Boolean) as string[]);
      return res.status(500).json({ error: vidErr?.message || 'Failed to save video metadata' });
    }

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del('paytune:categories:all'),
    ]);

    let contentIdScan: any = null;
    try {
      contentIdScan = await contentIdService.scanVideo({
        title: insertedVideo.title,
        description: insertedVideo.description || '',
        tags: parsedTags,
        videoUrl: resolvedVideoUrl,
      });
    } catch (cidErr) {
      console.warn('Content ID scan notice:', cidErr);
    }

    if (normalizedStatus === 'published' && normalizedVisibility === 'public') {
      void notifySubscribersNewVideo({
        id: insertedVideo.id,
        title: insertedVideo.title,
        artist_id: creator.artistId,
        is_short: isShort,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        ...insertedVideo,
        video_url: resolvedVideoUrl,
        preview_url: resolvedPreviewUrl || resolvedVideoUrl,
        thumbnail_url: resolvedThumbnailUrl || resolvedVideoUrl,
        duration: numericDuration || 0,
        category: insertedVideo.metadata?.category,
        price_rwf: finalPriceRwf,
        price_usd: finalPriceUsd,
        is_short: isShort,
        contentIdScan,
      },
    });
  } catch (error: any) {
    console.error('Complete upload error:', error);
    return res.status(500).json({ error: error.message || 'Failed to finalize uploaded video' });
  }
};
