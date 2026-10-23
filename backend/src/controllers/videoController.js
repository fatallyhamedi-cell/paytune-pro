const { supabase } = require('../config/supabase');

// GET /api/videos
async function listVideos(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const { data, error, count } = await supabase
      .from('videos')
      .select(`
        id, title, thumbnail_url, video_url, preview_url,
        price_rwf, price_usd, is_free, is_short, media_type,
        duration, category, views, likes, rating_avg, uploaded_at,
        artist_id,
        artists:artist_id (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('copyright_status', 'approved')
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn('[videoController] listVideos query fallback:', error.message);
      // Fallback query without foreign key alias if not defined
      const fallback = await supabase
        .from('videos')
        .select('*', { count: 'exact' })
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + limit - 1);
      return res.json({ videos: fallback.data || [], total: fallback.count || 0 });
    }
    return res.json({ videos: data || [], total: count || 0 });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/trending
async function getTrendingVideos(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, views, likes, artist_id, artists:artist_id (full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('copyright_status', 'approved')
      .order('views', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('views', { ascending: false })
        .limit(20);
      return res.json({ videos: fallback.data || [] });
    }
    return res.json({ videos: data || [] });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/new
async function getNewVideos(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, views, uploaded_at, artist_id, artists:artist_id (full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('copyright_status', 'approved')
      .order('uploaded_at', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })
        .limit(20);
      return res.json({ videos: fallback.data || [] });
    }
    return res.json({ videos: data || [] });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/recommended
async function getRecommendedVideos(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, views, rating_avg, artist_id, artists:artist_id (full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('copyright_status', 'approved')
      .order('rating_avg', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('rating_avg', { ascending: false })
        .limit(20);
      return res.json({ videos: fallback.data || [] });
    }
    return res.json({ videos: data || [] });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/:id
async function getVideoById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.userId || null;

    const { data: video, error } = await supabase
      .from('videos')
      .select(`
        *,
        artists:artist_id (id, full_name, avatar_url, follower_count)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!fallback.data) return res.status(404).json({ error: 'Video not found' });
      return res.json({ ...fallback.data, userOwns: false });
    }
    if (!video) return res.status(404).json({ error: 'Video not found' });

    let userOwns = false;
    if (userId) {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('video_id', id)
        .maybeSingle();
      userOwns = !!purchase;
    }

    return res.json({ ...video, userOwns });
  } catch (err) {
    next(err);
  }
}

// POST /api/videos/:id/view
async function recordView(req, res, next) {
  try {
    const { id } = req.params;
    const { data: video } = await supabase
      .from('videos')
      .select('views')
      .eq('id', id)
      .single();

    if (video) {
      await supabase
        .from('videos')
        .update({ views: (video.views || 0) + 1 })
        .eq('id', id);
    }

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVideos,
  getTrendingVideos,
  getNewVideos,
  getRecommendedVideos,
  getVideoById,
  recordView,
};
