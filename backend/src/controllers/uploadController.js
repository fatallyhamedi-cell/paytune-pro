const { supabase } = require('../config/supabase');
const { uploadBuffer } = require('../services/storageService');

async function uploadAvatar(req, res, next) {
  try {
    const artistId = req.artistId || req.userId;
    console.log('[AVATAR] artistId:', artistId, 'file:', req.file?.originalname, req.file?.size);

    if (!artistId) return res.status(401).json({ error: 'Auth required' });
    if (!req.file) return res.status(400).json({ error: 'No file (field "avatar")' });
    if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ error: 'Max 5 MB' });

    const up = await uploadBuffer(req.file.buffer, {
      bucket: 'avatars',
      userId: artistId,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    try {
      await supabase
        .from('artists')
        .update({
          avatar_url: up.url,
          profile_image: up.url
        })
        .or(`id.eq.${artistId},user_id.eq.${artistId}`);
    } catch (dbErr) {
      console.warn('[AVATAR] DB update warning:', dbErr.message);
    }

    console.log('[AVATAR] ✅ Saved:', up.url);
    return res.json({ success: true, url: up.url });
  } catch (err) {
    console.error('[AVATAR] ❌', err);
    next(err);
  }
}

async function uploadBanner(req, res, next) {
  try {
    const artistId = req.artistId || req.userId;
    console.log('[BANNER] artistId:', artistId, 'file:', req.file?.originalname);

    if (!artistId) return res.status(401).json({ error: 'Auth required' });
    if (!req.file) return res.status(400).json({ error: 'No file (field "banner")' });
    if (req.file.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'Max 10 MB' });

    const up = await uploadBuffer(req.file.buffer, {
      bucket: 'banners',
      userId: artistId,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    try {
      await supabase
        .from('artists')
        .update({
          banner_url: up.url,
          banner_image: up.url
        })
        .or(`id.eq.${artistId},user_id.eq.${artistId}`);
    } catch (dbErr) {
      console.warn('[BANNER] DB update warning:', dbErr.message);
    }

    console.log('[BANNER] ✅ Saved:', up.url);
    return res.json({ success: true, url: up.url });
  } catch (err) {
    console.error('[BANNER] ❌', err);
    next(err);
  }
}

async function uploadThumbnail(req, res, next) {
  try {
    const artistId = req.artistId || req.userId || 'artist';
    if (!req.file) return res.status(400).json({ error: 'No file (field "thumbnail")' });

    const up = await uploadBuffer(req.file.buffer, {
      bucket: 'thumbnails',
      userId: artistId,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    return res.json({ success: true, url: up.url });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadAvatar, uploadBanner, uploadThumbnail };
