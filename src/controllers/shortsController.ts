import { Request, Response } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getDbStore, notifyMutation } from '../config/supabase_mock';

// Helper to format artist information
function getArtistsDictionary(): Record<string, any> {
  const store = getDbStore();
  const map: Record<string, any> = {};
  if (store && Array.isArray(store.artists)) {
    store.artists.forEach((a: any) => {
      map[a.id] = a;
      if (a.user_id) map[a.user_id] = a;
    });
  }
  return map;
}

// Normalizer for vertical short format
function normalizeShort(v: any, artistsMap: Record<string, any>, currentUserId?: string) {
  const artist = v.artists || artistsMap[v.artist_id] || {
    id: v.artist_id || 'artist-1',
    full_name: v.artist_name || 'PAYTUNE Artist',
    username: 'paytune',
    profile_image: '',
    is_verified: true,
    subscriber_count: 14200
  };

  const store = getDbStore();
  
  // Check if current user liked this video
  let isLiked = false;
  if (currentUserId && store && Array.isArray(store.user_likes)) {
    isLiked = store.user_likes.some((l: any) => l.video_id === v.id && l.user_id === currentUserId);
  }

  // Check if current user is subscribed to artist
  let isSubscribed = false;
  if (currentUserId && store && Array.isArray(store.subscriptions)) {
    isSubscribed = store.subscriptions.some((s: any) => s.artist_id === artist.id && s.user_id === currentUserId);
  }

  // Get comments count
  let commentsCount = 0;
  if (store && Array.isArray(store.comments)) {
    commentsCount = store.comments.filter((c: any) => c.video_id === v.id).length;
  }
  if (commentsCount === 0) commentsCount = Math.floor((v.likes || 120) * 0.12) + 5;

  return {
    id: String(v.id),
    title: v.title || 'Untitled Short',
    description: v.description || '',
    artist_id: String(artist.id || v.artist_id || ''),
    artist_name: artist.full_name || v.artist_name || 'PAYTUNE Artist',
    artist_username: artist.username ? `@${artist.username.replace(/^@/, '')}` : '@artist',
    artist_avatar: artist.profile_image || '',
    artist_verified: !!artist.is_verified,
    subscribers_count: Number(artist.subscriber_count || artist.subscribers_count || 0),
    thumbnail_url: v.thumbnail_url || '',
    video_url: v.video_url || v.preview_url || '',
    vertical_url: v.vertical_url || v.video_url || v.preview_url || '',
    duration: Math.min(50, Number(v.duration || 30)),
    views: Number(v.views || 0),
    likes: Number(v.likes || 0),
    comments_count: commentsCount,
    shares_count: Number(v.shares_count || 0),
    created_at: v.uploaded_at || v.created_at || new Date().toISOString(),
    uploaded_at: v.uploaded_at || v.created_at || new Date().toISOString(),
    song_title: v.song_title || `${v.title?.replace(/[^a-zA-Z0-9 ]/g, '') || 'Original Sound'} • ${artist.full_name || 'PAYTUNE'}`,
    is_short: true,
    is_free: true,
    is_liked: isLiked,
    is_subscribed: isSubscribed,
    category: 'Shorts'
  };
}

/**
 * GET /api/shorts/feed
 * Query params: limit (default 20), offset (default 0), sort (new, trending, following, foryou)
 */
export const getShortsFeed = async (req: Request, res: Response) => {
  const {
    limit = '20',
    offset = '0',
    sort = 'trending'
  } = req.query;

  const numLimit = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
  const numOffset = Math.max(0, parseInt(String(offset), 10) || 0);
  const currentUserId = (req as any).user?.id;
  const artistsMap = getArtistsDictionary();

  try {
    let allShorts: any[] = [];

    // 1. Try fetching from Supabase
    try {
      let query = supabaseAdmin
        .from('videos')
        .select('*, artists(id, full_name, username, profile_image, is_verified, subscriber_count)')
        .eq('is_active', true)
        .or('category.eq.Shorts,category.ilike.%Short%');

      if (sort === 'new') {
        query = query.order('uploaded_at', { ascending: false });
      } else {
        query = query.order('views', { ascending: false });
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        allShorts = data.map((v: any) => normalizeShort(v, artistsMap, currentUserId));
      }
    } catch {
      // ignore
    }

    // 2. Blend or fallback with local high-fidelity mock store
    const store = getDbStore();
    const localShorts = (store?.videos || [])
      .filter((v: any) => v.is_active !== false && (v.is_short === true || v.category === 'Shorts' || v.category === 'Reels' || String(v.id).startsWith('short-')))
      .map((v: any) => normalizeShort(v, artistsMap, currentUserId));

    // Combine avoiding duplicate IDs
    const seenIds = new Set<string>();
    const combined: any[] = [];

    // Prioritize vertical formatted shorts first
    for (const item of [...localShorts, ...allShorts]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        combined.push(item);
      }
    }

    // Sort order
    if (sort === 'new') {
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'following' && currentUserId) {
      combined.sort((a, b) => (b.is_subscribed ? 1 : 0) - (a.is_subscribed ? 1 : 0));
    } else {
      // Trending: views & likes
      combined.sort((a, b) => (b.views + b.likes * 3) - (a.views + a.likes * 3));
    }

    const paginated = combined.slice(numOffset, numOffset + numLimit);
    const hasMore = numOffset + numLimit < combined.length;

    // Return structured payload with both items array and pagination keys
    return res.json({
      items: paginated,
      shorts: paginated, // backwards compatibility
      total: combined.length,
      nextOffset: hasMore ? numOffset + numLimit : null,
      hasMore: hasMore
    });
  } catch (error: any) {
    console.error('getShortsFeed error:', error);
    const store = getDbStore();
    const fallback = (store?.videos || [])
      .filter((v: any) => v.category === 'Shorts' || v.is_short || String(v.id).startsWith('short-'))
      .map((v: any) => normalizeShort(v, artistsMap, currentUserId));

    return res.json({
      items: fallback.slice(numOffset, numOffset + numLimit),
      shorts: fallback.slice(numOffset, numOffset + numLimit),
      total: fallback.length,
      nextOffset: null,
      hasMore: false
    });
  }
};

/**
 * GET /api/shorts/:id
 * Returns single short details
 */
export const getShortById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).user?.id;
  const artistsMap = getArtistsDictionary();

  try {
    const store = getDbStore();
    let video = store?.videos?.find((v: any) => String(v.id) === id);

    if (!video) {
      try {
        const { data } = await supabaseAdmin
          .from('videos')
          .select('*, artists(*)')
          .eq('id', id)
          .maybeSingle();
        if (data) video = data;
      } catch {
        // ignore
      }
    }

    if (!video) {
      // Default to first short if not found
      video = store?.videos?.find((v: any) => v.category === 'Shorts' || v.is_short) || store?.videos?.[0];
    }

    if (!video) {
      return res.status(404).json({ error: 'Short video not found' });
    }

    const normalized = normalizeShort(video, artistsMap, currentUserId);
    res.json(normalized);
  } catch (error: any) {
    console.error('getShortById error:', error);
    res.status(500).json({ error: 'Failed to retrieve short' });
  }
};

/**
 * POST /api/shorts/:id/like
 * Toggle like on a short
 */
export const toggleShortLike = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const userId = user?.id || 'guest-user-session';
  const store = getDbStore();

  if (!store) {
    return res.status(500).json({ error: 'Database store unavailable' });
  }

  if (!store.user_likes) store.user_likes = [];
  if (!store.videos) store.videos = [];

  const video = store.videos.find((v: any) => String(v.id) === id);
  const existingLikeIndex = store.user_likes.findIndex(
    (l: any) => String(l.video_id) === id && String(l.user_id) === userId
  );

  let liked = false;
  let currentLikes = video ? Number(video.likes || 0) : 0;

  if (existingLikeIndex >= 0) {
    // Unlike
    store.user_likes.splice(existingLikeIndex, 1);
    liked = false;
    currentLikes = Math.max(0, currentLikes - 1);
  } else {
    // Like
    store.user_likes.push({
      id: `like-${Date.now()}`,
      video_id: id,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    liked = true;
    currentLikes += 1;
  }

  if (video) {
    video.likes = currentLikes;
  }

  // Also update remote Supabase if possible
  try {
    supabaseAdmin.from('videos').update({ likes: currentLikes }).eq('id', id).then(() => {}).catch(() => {});
  } catch {
    // ignore
  }

  notifyMutation(store);

  res.json({
    success: true,
    liked,
    likes: currentLikes
  });
};

/**
 * POST /api/shorts/:id/view
 * Record video view and log to shorts_analytics table
 */
export const recordShortView = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    watched_seconds = 0,
    completed = false,
    device_type = 'mobile',
    country = 'RW'
  } = req.body || {};

  const user = (req as any).user;
  const userId = user?.id || null;
  const store = getDbStore();

  if (!store) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  if (!store.shorts_analytics) store.shorts_analytics = [];
  if (!store.videos) store.videos = [];

  const video = store.videos.find((v: any) => String(v.id) === id);
  const newViews = (video ? Number(video.views || 0) : 0) + 1;
  if (video) {
    video.views = newViews;
  }

  // Insert into analytics table
  const analyticsRecord = {
    id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    short_id: id,
    user_id: userId,
    watched_seconds: Number(watched_seconds) || 0,
    completed: Boolean(completed),
    device_type: String(device_type).substring(0, 50),
    country: String(country).substring(0, 10),
    watched_at: new Date().toISOString()
  };

  store.shorts_analytics.push(analyticsRecord);

  // Persist to Supabase analytics table
  supabaseAdmin
    .from('shorts_analytics')
    .insert(analyticsRecord)
    .then(() => {})
    .catch(() => {});

  notifyMutation(store);

  res.json({
    success: true,
    views: newViews
  });
};

/**
 * POST /api/shorts/:id/subscribe
 * Subscribe to the artist who created this short
 */
export const toggleShortSubscribe = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const userId = user?.id || 'guest-user-session';
  const store = getDbStore();

  if (!store) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  if (!store.subscriptions) store.subscriptions = [];
  if (!store.artists) store.artists = [];

  // Find video to locate artist
  const video = store.videos?.find((v: any) => String(v.id) === id);
  const artistId = video?.artist_id || 'artist-1';
  const artist = store.artists.find((a: any) => a.id === artistId);

  const existingSubIndex = store.subscriptions.findIndex(
    (s: any) => String(s.artist_id) === artistId && String(s.user_id) === userId
  );

  let subscribed = false;
  let subCount = artist ? Number(artist.subscriber_count || artist.subscribers_count || 0) : 0;

  if (existingSubIndex >= 0) {
    // Unsubscribe
    store.subscriptions.splice(existingSubIndex, 1);
    subscribed = false;
    subCount = Math.max(0, subCount - 1);
  } else {
    // Subscribe
    store.subscriptions.push({
      id: `sub-${Date.now()}`,
      artist_id: artistId,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    subscribed = true;
    subCount += 1;
  }

  if (artist) {
    artist.subscriber_count = subCount;
    artist.subscribers_count = subCount;
  }

  notifyMutation(store);

  res.json({
    success: true,
    subscribed,
    followed: subscribed,
    subscribers_count: subCount,
    followers_count: subCount,
    artist_id: artistId
  });
};

export const toggleShortFollow = toggleShortSubscribe;

/**
 * GET /api/shorts/:id/comments
 * Fetch comments for a specific short
 */
export const getShortComments = async (req: Request, res: Response) => {
  const { id } = req.params;
  const store = getDbStore();

  let comments: any[] = [];
  if (store && Array.isArray(store.comments)) {
    comments = store.comments.filter((c: any) => String(c.video_id) === id);
  }

  res.json(comments);
};

/**
 * POST /api/shorts/:id/comments
 * Post a new comment on a short
 */
export const postShortComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body || {};
  const user = (req as any).user;

  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  const store = getDbStore();
  if (!store) {
    return res.status(500).json({ error: 'Store unavailable' });
  }

  if (!store.comments) store.comments = [];

  const newComment = {
    id: `c-${Date.now()}`,
    video_id: id,
    user_id: user?.id || 'guest-user',
    user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kigali Fan',
    user_avatar: user?.user_metadata?.avatar_url || '',
    content: String(content).trim(),
    created_at: new Date().toISOString(),
    likes: 0
  };

  store.comments.unshift(newComment);
  notifyMutation(store);

  res.json({
    success: true,
    comment: newComment
  });
};
