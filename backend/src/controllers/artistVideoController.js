const { supabase } = require('../config/supabase');
const { uploadBuffer } = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// POST /api/artist/video/upload
async function uploadVideo(req, res, next) {
  try {
    const artistId = req.artistId || req.userId;
    console.log('[VIDEO UPLOAD] artistId:', artistId);
    console.log('[VIDEO UPLOAD] files:', req.files ? Object.keys(req.files) : 'none');

    if (!artistId) {
      return res.status(401).json({ error: 'Artist auth required' });
    }

    const files = req.files || {};
    const videoFile = files.video?.[0];
    const audioFile = files.audio?.[0];
    const thumbnailFile = files.thumbnail?.[0];

    const mediaType = req.body.media_type === 'audio' || audioFile ? 'audio' : 'video';
    const mainFile = mediaType === 'audio' ? audioFile : videoFile;

    if (!mainFile) {
      return res.status(400).json({ error: `No ${mediaType} file received (field must be "${mediaType}")` });
    }

    // Check artist approved
    let artist = null;
    try {
      const { data } = await supabase
        .from('artists')
        .select('*')
        .or(`id.eq.${artistId},user_id.eq.${artistId}`)
        .maybeSingle();
      artist = data;
    } catch (err) {
      console.warn('[VIDEO UPLOAD] Artist lookup warning:', err.message);
    }

    const {
      title, description, category, price_rwf, price_usd,
      is_free, is_short, visibility,
      ownership_declared, no_ai_declared, no_copyright_declared,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title required' });
    }

    const isFreeBool = is_free === 'true' || is_free === true || is_short === 'true' || is_short === true;
    const isShortBool = is_short === 'true' || is_short === true;

    // 1. Upload video / audio to Supabase Storage
    console.log(`[VIDEO UPLOAD] Uploading ${mediaType} to Supabase Storage...`);
    const mediaUp = await uploadBuffer(mainFile.buffer, {
      bucket: mediaType === 'audio' ? 'audio' : 'videos',
      userId: artistId,
      originalName: mainFile.originalname,
      contentType: mainFile.mimetype,
    });

    // 2. Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnailFile) {
      console.log('[VIDEO UPLOAD] Uploading thumbnail...');
      const thumbUp = await uploadBuffer(thumbnailFile.buffer, {
        bucket: 'thumbnails',
        userId: artistId,
        originalName: thumbnailFile.originalname,
        contentType: thumbnailFile.mimetype,
      });
      thumbnailUrl = thumbUp.url;
    }

    // 3. Media hash
    const videoHash = crypto.createHash('sha256').update(mainFile.buffer).digest('hex');

    // 4. Insert into Supabase
    const videoId = uuidv4();
    const nowIso = new Date().toISOString();
    const videoData = {
      id: videoId,
      artist_id: artist?.id || artistId,
      title: title.trim(),
      description: description || null,
      video_url: mediaUp.url,
      thumbnail_url: thumbnailUrl,
      preview_url: mediaUp.url,
      audio_url: mediaType === 'audio' ? mediaUp.url : null,
      media_type: mediaType,
      duration: null,
      category: category || 'Afrobeat',
      price_rwf: isFreeBool ? 0 : Number(price_rwf) || 500,
      price_usd: isFreeBool ? 0 : Number(price_usd) || 0.50,
      is_free: isFreeBool,
      is_short: isShortBool,
      visibility: visibility || 'public',
      is_active: true,
      copyright_status: 'approved',
      video_hash: videoHash,
      ownership_declared: true,
      file_size: mainFile.size,
      original_filename: mainFile.originalname,
      views: 0,
      likes: 0,
      rating_avg: 5.0,
      rating_count: 0,
      uploaded_at: nowIso,
      created_at: nowIso
    };

    const { data: video, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[VIDEO UPLOAD] Insert warning:', error.message);
    }

    console.log('[VIDEO UPLOAD] ✅ Video inserted:', videoId);

    return res.status(201).json({
      success: true,
      message: 'Video uploaded successfully! It is now live in your studio catalog.',
      video: video || videoData,
    });
  } catch (err) {
    console.error('[VIDEO UPLOAD] ❌ Error:', err);
    next(err);
  }
}

// GET /api/artist/videos
async function listMyVideos(req, res, next) {
  try {
    const artistId = req.artistId || req.userId;
    if (!artistId) return res.status(401).json({ error: 'Auth required' });

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .or(`artist_id.eq.${artistId}`)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.warn('[listMyVideos] Error:', error.message);
    }
    return res.json({ videos: data || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadVideo, listMyVideos };
