import { Response } from 'express';
import { randomUUID } from 'crypto';
import { supabase, supabaseAdmin } from '../config/supabase';
import { uploadBuffer } from '../services/storageService';
import { ArtistRequest } from '../middleware/authArtist';

const db = supabaseAdmin || supabase;

// POST /api/artist/video/upload
// multipart fields: video (file) | audio (file) | thumbnail (file)
// body: title, description, category, price_rwf, price_usd, is_free, visibility, is_short, media_type
export async function uploadVideo(req: ArtistRequest, res: Response) {
  try {
    const artistId = req.artistId;
    const userId = req.artistUserId || artistId || 'artist';

    if (!artistId) {
      return res.status(401).json({ error: 'Artist session required' });
    }

    const files = req.files as { [k: string]: Express.Multer.File[] } | undefined;
    const videoFile = files?.video?.[0];
    const audioFile = files?.audio?.[0];
    const thumbFile = files?.thumbnail?.[0];

    const mediaType = req.body.media_type || (audioFile ? 'audio' : 'video');
    if (mediaType === 'video' && !videoFile) {
      return res.status(400).json({ error: 'Video file is required from your device' });
    }
    if (mediaType === 'audio' && !audioFile) {
      return res.status(400).json({ error: 'Audio file is required from your device' });
    }

    const {
      title, description, category,
      price_rwf, price_usd, is_free, visibility, is_short,
    } = req.body;

    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ error: 'Track or video title is required' });
    }

    const isFree = is_free === 'true' || is_free === true || is_short === 'true';

    // 1. Upload media (video or audio)
    let mediaUrl = '';
    let mediaSize = 0;
    let mediaOriginalName = '';
    let audioUrl: string | null = null;

    if (mediaType === 'video' && videoFile) {
      const up = await uploadBuffer({
        bucket: 'videos',
        userId,
        buffer: videoFile.buffer,
        originalName: videoFile.originalname,
        contentType: videoFile.mimetype,
      });
      mediaUrl = up.url;
      mediaSize = videoFile.size;
      mediaOriginalName = videoFile.originalname;
    } else if (mediaType === 'audio' && audioFile) {
      const up = await uploadBuffer({
        bucket: 'audio',
        userId,
        buffer: audioFile.buffer,
        originalName: audioFile.originalname,
        contentType: audioFile.mimetype,
      });
      mediaUrl = up.url;
      audioUrl = up.url;
      mediaSize = audioFile.size;
      mediaOriginalName = audioFile.originalname;
    }

    // 2. Upload thumbnail if provided
    let thumbnailUrl: string | null = null;
    if (thumbFile) {
      const up = await uploadBuffer({
        bucket: 'thumbnails',
        userId,
        buffer: thumbFile.buffer,
        originalName: thumbFile.originalname,
        contentType: thumbFile.mimetype,
      });
      thumbnailUrl = up.url;
    }

    const videoId = randomUUID();
    const now = new Date().toISOString();

    // 3. Insert video row into videos table
    const videoPayload = {
      id: videoId,
      artist_id: artistId,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      category: category ? String(category).trim() : 'Afrobeat',
      price_rwf: isFree ? 0 : Number(price_rwf) || 500,
      price_usd: isFree ? 0 : Number(price_usd) || 0.5,
      is_free: isFree,
      is_short: is_short === 'true' || is_short === true,
      media_type: mediaType,
      video_url: mediaUrl,
      audio_url: audioUrl,
      thumbnail_url: thumbnailUrl,
      preview_url: mediaUrl,
      visibility: visibility || 'public',
      is_active: true,
      views: 0,
      likes: 0,
      rating_avg: 5.0,
      rating_count: 0,
      file_size: mediaSize,
      original_filename: mediaOriginalName,
      uploaded_at: now,
      created_at: now
    };

    const { data: video, error } = await db
      .from('videos')
      .insert([videoPayload])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[artistVideoController] Insert warning:', error.message);
    }

    return res.status(201).json({
      success: true,
      video: video || videoPayload
    });
  } catch (err: any) {
    console.error('[artistVideoController] uploadVideo error:', err);
    return res.status(500).json({ error: err.message || 'Media upload failed' });
  }
}
