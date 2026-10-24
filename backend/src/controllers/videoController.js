const { supabase } = require('../config/supabase');

// Helper to extract authenticated user ID from request
function getUserId(req) {
  if (req.user && req.user.id) return req.user.id;
  if (req.userId) return req.userId;
  if (req.headers && req.headers['x-user-id']) return req.headers['x-user-id'];

  // Check Bearer token in authorization header
  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded && (decoded.id || decoded.sub || decoded.user_id)) {
        return decoded.id || decoded.sub || decoded.user_id;
      }
    } catch (e) {}
  }
  return null;
}

// GET /api/videos
async function listVideos(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const category = req.query.category;

    let query = supabase
      .from('videos')
      .select(`
        id, title, thumbnail_url, video_url, preview_url,
        price_rwf, price_usd, is_free, is_short,
        duration, category, views, likes, rating_avg, uploaded_at,
        artist_id,
        artists:artist_id (id, full_name, profile_image)
      `, { count: 'exact' })
      .eq('is_active', true);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn('[videoController] listVideos query fallback:', error.message);
      const fallback = await supabase
        .from('videos')
        .select('*', { count: 'exact' })
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
      .select('id, title, thumbnail_url, views, likes, artist_id, artists:artist_id (full_name, profile_image)')
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
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
      .select('id, title, thumbnail_url, views, uploaded_at, artist_id, artists:artist_id (full_name, profile_image)')
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
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
      .select('id, title, thumbnail_url, views, rating_avg, artist_id, artists:artist_id (full_name, profile_image)')
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(20);

    if (error) {
      const fallback = await supabase
        .from('videos')
        .select('*')
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
    const userId = getUserId(req);

    console.log(`[videoController] Fetching video ID: ${id}, Viewer UserID: ${userId}`);

    const { data: video, error } = await supabase
      .from('videos')
      .select(`
        *,
        artists:artist_id (id, full_name, profile_image, subscribers_count)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !video) {
      console.warn(`[videoController] Primary fetch failed for video ${id}, trying fallback:`, error?.message);
      const fallback = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!fallback.data) {
        return res.status(404).json({ error: 'Video not found' });
      }

      let userOwns = fallback.data.is_free === true;
      if (userId && !userOwns) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', userId)
          .eq('video_id', id)
          .maybeSingle();
        userOwns = !!purchase;
      }

      return res.json({
        ...fallback.data,
        artist_name: fallback.data.artist_name || 'PAYTUNE Artist',
        userOwns,
        userLiked: false,
        userSubscribed: false,
        userRating: 0
      });
    }

    // Determine ownership
    let userOwns = video.is_free === true;
    let userLiked = false;
    let userSubscribed = false;
    let userRating = 0;

    if (userId) {
      // Check purchase
      if (!userOwns) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', userId)
          .eq('video_id', id)
          .maybeSingle();
        userOwns = !!purchase;
      }

      // Check like status
      const { data: likeRecord } = await supabase
        .from('user_likes')
        .select('id')
        .eq('video_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      userLiked = !!likeRecord;

      // Check subscription / follow status
      if (video.artist_id) {
        const { data: subRecord } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('artist_id', video.artist_id)
          .eq('user_id', userId)
          .maybeSingle();
        userSubscribed = !!subRecord;
      }

      // Check rating
      const { data: ratingRecord } = await supabase
        .from('user_ratings')
        .select('rating')
        .eq('video_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (ratingRecord) {
        userRating = ratingRecord.rating;
      }
    }

    const artistObj = video.artists || {};
    return res.json({
      ...video,
      artist_name: artistObj.full_name || video.artist_name || 'PAYTUNE Artist',
      artists: {
        id: video.artist_id,
        full_name: artistObj.full_name || video.artist_name || 'PAYTUNE Artist',
        profile_image: artistObj.profile_image || '',
        subscribers_count: artistObj.subscribers_count || 14200
      },
      userOwns,
      userLiked,
      userSubscribed,
      userRating
    });
  } catch (err) {
    console.error('[videoController] getVideoById error:', err);
    next(err);
  }
}

// POST /api/videos/:id/view
async function recordView(req, res, next) {
  try {
    const { id } = req.params;
    console.log(`[videoController] Recording view for video: ${id}`);

    const { data: video } = await supabase
      .from('videos')
      .select('views')
      .eq('id', id)
      .maybeSingle();

    const currentViews = video?.views || 0;
    const newViews = currentViews + 1;

    await supabase
      .from('videos')
      .update({ views: newViews })
      .eq('id', id);

    return res.json({ success: true, views: newViews });
  } catch (err) {
    console.error('[videoController] recordView error:', err);
    next(err);
  }
}

// POST /api/videos/:id/like (Add like)
async function addLike(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to like video' });
    }

    console.log(`[videoController] Adding like for video: ${id} by user: ${userId}`);

    // Check if already liked
    const { data: existing } = await supabase
      .from('user_likes')
      .select('id')
      .eq('video_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: video } = await supabase
      .from('videos')
      .select('likes')
      .eq('id', id)
      .maybeSingle();

    let likesCount = video?.likes || 0;

    if (!existing) {
      await supabase.from('user_likes').insert({
        video_id: id,
        user_id: userId
      });
      likesCount += 1;
      await supabase.from('videos').update({ likes: likesCount }).eq('id', id);
    }

    return res.json({ success: true, liked: true, likes: likesCount });
  } catch (err) {
    console.error('[videoController] addLike error:', err);
    next(err);
  }
}

// DELETE /api/videos/:id/like (Remove like)
async function removeLike(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to unlike video' });
    }

    console.log(`[videoController] Removing like for video: ${id} by user: ${userId}`);

    const { data: existing } = await supabase
      .from('user_likes')
      .select('id')
      .eq('video_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: video } = await supabase
      .from('videos')
      .select('likes')
      .eq('id', id)
      .maybeSingle();

    let likesCount = video?.likes || 0;

    if (existing) {
      await supabase.from('user_likes').delete().eq('id', existing.id);
      likesCount = Math.max(0, likesCount - 1);
      await supabase.from('videos').update({ likes: likesCount }).eq('id', id);
    }

    return res.json({ success: true, liked: false, likes: likesCount });
  } catch (err) {
    console.error('[videoController] removeLike error:', err);
    next(err);
  }
}

// POST /api/videos/:id/rate (Submit 1-5 star rating)
async function rateVideo(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const rating = Number(req.body.rating);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to rate' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    console.log(`[videoController] Rating video ${id} with ${rating} stars by user ${userId}`);

    // Upsert into user_ratings
    await supabase
      .from('user_ratings')
      .upsert({
        user_id: userId,
        video_id: id,
        rating,
        rated_at: new Date().toISOString()
      }, { onConflict: 'user_id,video_id' });

    // Calculate updated average
    const { data: allRatings } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('video_id', id);

    let avg = rating;
    let count = 1;

    if (allRatings && allRatings.length > 0) {
      count = allRatings.length;
      const sum = allRatings.reduce((acc, r) => acc + (r.rating || 0), 0);
      avg = parseFloat((sum / count).toFixed(1));
    }

    await supabase
      .from('videos')
      .update({ rating_avg: avg, rating_count: count })
      .eq('id', id);

    return res.json({
      success: true,
      message: 'Rating recorded successfully',
      rating,
      rating_avg: avg,
      rating_count: count
    });
  } catch (err) {
    console.error('[videoController] rateVideo error:', err);
    next(err);
  }
}

// POST /api/artists/:id/follow (Follow artist)
async function followArtist(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to follow artist' });
    }

    console.log(`[videoController] User ${userId} following artist/video ${id}`);

    // Resolve artist ID (if passed a video ID or artist ID)
    let targetArtistId = id;
    const { data: vid } = await supabase
      .from('videos')
      .select('artist_id')
      .eq('id', id)
      .maybeSingle();

    if (vid && vid.artist_id) {
      targetArtistId = vid.artist_id;
    }

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('artist_id', targetArtistId)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: artist } = await supabase
      .from('artists')
      .select('subscribers_count')
      .eq('id', targetArtistId)
      .maybeSingle();

    let count = artist?.subscribers_count || 14200;

    if (!existing) {
      await supabase.from('subscriptions').insert({
        artist_id: targetArtistId,
        user_id: userId
      });
      count += 1;
      await supabase.from('artists').update({ subscribers_count: count }).eq('id', targetArtistId);
    }

    return res.json({
      success: true,
      following: true,
      followers_count: count,
      subscribers_count: count
    });
  } catch (err) {
    console.error('[videoController] followArtist error:', err);
    next(err);
  }
}

// DELETE /api/artists/:id/follow (Unfollow artist)
async function unfollowArtist(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to unfollow' });
    }

    console.log(`[videoController] User ${userId} unfollowing artist/video ${id}`);

    let targetArtistId = id;
    const { data: vid } = await supabase
      .from('videos')
      .select('artist_id')
      .eq('id', id)
      .maybeSingle();

    if (vid && vid.artist_id) {
      targetArtistId = vid.artist_id;
    }

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('artist_id', targetArtistId)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: artist } = await supabase
      .from('artists')
      .select('subscribers_count')
      .eq('id', targetArtistId)
      .maybeSingle();

    let count = artist?.subscribers_count || 14200;

    if (existing) {
      await supabase.from('subscriptions').delete().eq('id', existing.id);
      count = Math.max(0, count - 1);
      await supabase.from('artists').update({ subscribers_count: count }).eq('id', targetArtistId);
    }

    return res.json({
      success: true,
      following: false,
      followers_count: count,
      subscribers_count: count
    });
  } catch (err) {
    console.error('[videoController] unfollowArtist error:', err);
    next(err);
  }
}

// GET /api/videos/:id/comments
async function getComments(req, res, next) {
  try {
    const { id } = req.params;
    console.log(`[videoController] Fetching comments for video: ${id}`);

    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, video_id, user_id, comment_text, created_at, likes, is_pinned,
        profiles:user_id (id, full_name, username, profile_image, avatar_url)
      `)
      .eq('video_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[videoController] getComments fallback query:', error.message);
      const fallback = await supabase
        .from('comments')
        .select('*')
        .eq('video_id', id)
        .order('created_at', { ascending: false });
      return res.json(fallback.data || []);
    }

    const formatted = (data || []).map((c) => {
      const profile = c.profiles || {};
      return {
        id: c.id,
        video_id: c.video_id,
        user_id: c.user_id,
        comment_text: c.comment_text,
        text: c.comment_text,
        user_name: profile.full_name || profile.username || 'Fan',
        user_avatar: profile.profile_image || profile.avatar_url || '',
        created_at: c.created_at,
        likes: c.likes || 0,
        is_pinned: c.is_pinned || false
      };
    });

    return res.json(formatted);
  } catch (err) {
    console.error('[videoController] getComments error:', err);
    next(err);
  }
}

// POST /api/videos/:id/comments
async function postComment(req, res, next) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const text = req.body.text || req.body.comment || req.body.content;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to post comments' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty' });
    }

    console.log(`[videoController] User ${userId} posted comment on video ${id}: "${text.trim()}"`);

    // Fetch user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username, profile_image')
      .eq('id', userId)
      .maybeSingle();

    const userName = profile?.full_name || profile?.username || req.user?.user_metadata?.full_name || 'Music Fan';

    const newComment = {
      id: 'cmt-' + Date.now() + Math.random().toString(36).substring(2, 6),
      video_id: id,
      user_id: userId,
      comment_text: text.trim(),
      created_at: new Date().toISOString(),
      likes: 0,
      is_pinned: false
    };

    const { data, error } = await supabase
      .from('comments')
      .insert(newComment)
      .select()
      .maybeSingle();

    const responseObj = {
      ...(data || newComment),
      text: text.trim(),
      user_name: userName,
      user_avatar: profile?.profile_image || ''
    };

    return res.status(201).json(responseObj);
  } catch (err) {
    console.error('[videoController] postComment error:', err);
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
  addLike,
  removeLike,
  rateVideo,
  followArtist,
  unfollowArtist,
  getComments,
  postComment
};
