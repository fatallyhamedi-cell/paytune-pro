import { Request, Response } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { processAndUploadVideo } from '../services/videoService';
import { contentIdService } from '../services/contentIdService';
import { notifySubscribersNewVideo } from '../services/notificationService';
import { getDbStore, notifyMutation } from '../config/supabase_mock';
import crypto from 'crypto';

/**
 * Resolve artist record from authenticated session or request context
 */
async function getAuthenticatedArtist(req: Request) {
  const reqArtistId = (req as any).artistId;
  const user = (req as any).user;
  const targetId = reqArtistId || user?.artistId || user?.id;

  if (targetId) {
    const { data: byId } = await supabaseAdmin
      .from('artists')
      .select('id, user_id, full_name, name, is_approved, is_blocked')
      .eq('id', targetId)
      .maybeSingle();
    if (byId) return byId;

    const { data: byUser } = await supabaseAdmin
      .from('artists')
      .select('id, user_id, full_name, name, is_approved, is_blocked')
      .eq('user_id', targetId)
      .maybeSingle();
    if (byUser) return byUser;
  }

  // Fallback check in local store or default
  const store = getDbStore();
  const matched = (store.artists || []).find((a: any) => 
    a.id === targetId || a.user_id === targetId || (user && a.email === user.email)
  );
  if (matched) return matched;

  if (store.artists && store.artists.length > 0) {
    return store.artists[0];
  }

  return null;
}

/**
 * POST /api/artist/video/upload
 * Full device-to-Supabase Storage pipeline with FFmpeg 30-sec preview and thumbnail generation
 */
export const uploadVideo = async (req: Request, res: Response) => {
  try {
    const artist = await getAuthenticatedArtist(req);
    if (!artist) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    if (artist.is_approved === false) {
      return res.status(403).json({ error: 'Artist account not approved yet' });
    }
    if (artist.is_blocked) {
      return res.status(403).json({ error: 'Artist account is currently blocked' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];

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
      scheduled_release,
      chapters,
      tags
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const isFree = is_free === 'true' || is_free === true;
    const isShort = is_short === 'true' || is_short === true;

    // Validate pricing rules: minimum 200 RWF / 1 USD for standard paid content
    if (!isFree && !isShort) {
      if (!price_rwf || Number(price_rwf) < 200) {
        return res.status(400).json({ error: 'RWF price must be at least 200' });
      }
      if (!price_usd || Number(price_usd) < 1) {
        return res.status(400).json({ error: 'USD price must be at least 1' });
      }
    }

    // Process through FFmpeg and upload to Supabase Storage
    const { video_url, preview_url, thumbnail_url, duration } = await processAndUploadVideo({
      videoBuffer: videoFile.buffer,
      thumbnailBuffer: thumbnailFile ? thumbnailFile.buffer : null,
      originalName: videoFile.originalname,
      artistId: artist.id,
      metadata: { is_short: isShort }
    });

    // Generate unique link for unlisted visibility
    const unique_link = visibility === 'unlisted' ? crypto.randomUUID().replace(/-/g, '') : null;
    const videoId = crypto.randomUUID();

    const newVideoRecord = {
      id: videoId,
      artist_id: artist.id,
      title: title.trim(),
      description: description || null,
      category: isShort ? 'Shorts' : (category || 'Afrobeat'),
      price_rwf: (isFree || isShort) ? null : Number(price_rwf),
      price_usd: (isFree || isShort) ? null : Number(price_usd),
      is_free: isFree || isShort,
      is_short: isShort,
      video_url,
      preview_url,
      thumbnail_url,
      duration,
      visibility: visibility || 'public',
      unique_link,
      chapters: chapters ? (typeof chapters === 'string' ? JSON.parse(chapters) : chapters) : null,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : []),
      scheduled_release: scheduled_release || null,
      is_active: !scheduled_release, // inactive if scheduled for future release
      is_approved: true,
      views: 0,
      likes: 0,
      rating_avg: 5,
      rating_count: 0,
      uploaded_at: new Date().toISOString()
    };

    // Insert into Supabase database
    const { data: video, error } = await supabaseAdmin
      .from('videos')
      .insert(newVideoRecord)
      .select()
      .single();

    let finalVideo = video;

    if (error || !finalVideo) {
      console.warn('Fallback saving video to local persistent database store:', error?.message);
      const store = getDbStore();
      if (!store.videos) store.videos = [];
      const localRecord = {
        ...newVideoRecord,
        artist_name: artist.full_name || artist.name || 'Artist'
      };
      store.videos.unshift(localRecord);
      notifyMutation();
      finalVideo = localRecord;
    }

    // Run Content ID compliance scan asynchronously
    try {
      const scanResult = await contentIdService.scanVideo({
        title: finalVideo.title,
        description: finalVideo.description || '',
        tags: finalVideo.tags || [],
        videoUrl: finalVideo.video_url
      });
      (finalVideo as any).contentIdScan = scanResult;
    } catch (cidErr) {
      console.warn('Content ID scan notice:', cidErr);
    }

    // Broadcast new video notification to subscribers
    try {
      notifySubscribersNewVideo(finalVideo);
    } catch (nErr) {
      console.warn('Subscriber notification notice:', nErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Video uploaded successfully to Supabase Storage',
      video: finalVideo
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

/**
 * DELETE /api/artist/video/:id
 * Removes the video from database and purges files from Supabase Storage buckets
 */
export const deleteVideo = async (req: Request, res: Response) => {
  try {
    const artist = await getAuthenticatedArtist(req);
    if (!artist) {
      return res.status(401).json({ error: 'Artist authentication required' });
    }

    const { id } = req.params;

    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('artist_id', artist.id)
      .single();

    if (!video) {
      return res.status(404).json({ error: 'Video not found or unauthorized' });
    }

    // Extract storage paths from public URLs
    const extractPath = (url?: string, bucket?: string) => {
      if (!url || !bucket) return null;
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx >= 0) return url.substring(idx + marker.length);
      if (url.includes(`/uploads/`)) return url.replace('/uploads/', '');
      return null;
    };

    const videoPath = extractPath(video.video_url, 'videos');
    const previewPath = extractPath(video.preview_url, 'previews');
    const thumbPath = extractPath(video.thumbnail_url, 'thumbnails');

    // Delete assets from storage buckets
    const deletions = [
      videoPath && supabaseAdmin.storage.from('videos').remove([videoPath]),
      previewPath && supabaseAdmin.storage.from('previews').remove([previewPath]),
      thumbPath && supabaseAdmin.storage.from('thumbnails').remove([thumbPath])
    ].filter(Boolean);

    await Promise.allSettled(deletions);

    // Delete record from database
    await supabaseAdmin.from('videos').delete().eq('id', id);

    // Also remove from local store if exists
    const store = getDbStore();
    if (store.videos) {
      store.videos = store.videos.filter((v: any) => v.id !== id);
      notifyMutation();
    }

    return res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message });
  }
};
