import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';
import { cacheService } from '../services/cacheService';

const sanitizeMediaUrl = (url?: string): string => {
  if (!url) return '';
  return url;
};

/**
 * Infers content type ('series' | 'music' | 'course' | 'movie' | 'short') for dynamic sidebar rendering
 */
function inferContentType(v: any, meta: any): 'series' | 'music' | 'course' | 'movie' | 'short' {
  const explicit = String(v.content_type || meta?.content_type || v.video_type || '').toLowerCase();
  if (['series', 'music', 'course', 'movie', 'short'].includes(explicit)) {
    return explicit as any;
  }
  if (explicit.includes('episode') || explicit.includes('drama') || v.series_id || meta?.series_id) {
    return 'series';
  }
  if (v.is_short || ['shorts', 'reels', 'reel', 'reels video'].includes(String(v.category || '').toLowerCase())) {
    return 'short';
  }
  const cat = String(v.category || meta?.category || '').toLowerCase();
  if (cat.includes('course') || cat.includes('lesson') || cat.includes('tutorial') || cat.includes('education')) {
    return 'course';
  }
  if (cat.includes('movie') || cat.includes('film') || cat.includes('cinema')) {
    return 'movie';
  }
  if (cat.includes('series') || cat.includes('drama') || cat.includes('podcast') || cat.includes('show')) {
    return 'series';
  }
  return 'music';
}

/**
 * Normalizes video record strictly from live PostgreSQL `videos` table + joined/looked-up creator profile.
 * Zero fake defaults or fabricated counts.
 */
function normalizeVideo(v: any, artistsMap?: Record<string, any>) {
  const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
  const artistId = String(v.artist_profile_id || v.creator_channel_id || v.artist_id || meta.artist_id || '');

  const isShort =
    Boolean(v.is_short) ||
    meta.is_short === true ||
    v.video_type === 'short' ||
    ['shorts', 'reels', 'reel', 'reels video'].includes(String(v.category || meta.category || '').toLowerCase());

  const artist =
    v.artists ||
    (artistId && artistsMap ? artistsMap[artistId] : null) || {
      id: artistId || null,
      full_name: v.artist_name || meta.artist_name || 'Creator',
      profile_image: meta.artist_avatar || '',
      is_verified: false,
      subscribers_count: 0,
    };

  const priceRwfRaw = Number(v.price_minor ?? v.price_rwf ?? meta.price_rwf ?? 0);
  const isFree = isShort ? true : v.is_free === true || (!v.is_paywalled && priceRwfRaw <= 0);
  const priceRwf = isShort || isFree ? 0 : priceRwfRaw;
  const priceUsd = isShort || isFree ? 0 : Number(v.price_usd ?? meta.price_usd ?? (priceRwf > 0 ? Number((priceRwf / 1300).toFixed(2)) : 0));

  const rawCategory = v.category || meta.category || '';
  const tagsSource = v.tags ?? meta.tags;
  const tags = Array.isArray(tagsSource)
    ? tagsSource
    : typeof tagsSource === 'string'
      ? tagsSource.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

  const uploadedAt = v.published_at || v.uploaded_at || v.created_at || new Date().toISOString();
  const ageMs = Date.now() - new Date(uploadedAt).getTime();
  const isNew = typeof v.is_new === 'boolean' ? v.is_new : (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000);

  const rawVideoUrl = v.video_url || v.playback_url || meta.video_url || '';
  const rawPreviewUrl = v.preview_url || meta.preview_url || rawVideoUrl;
  const contentType = inferContentType(v, meta);

  return {
    id: String(v.id),
    title: v.title || '',
    artist_name: artist.full_name || artist.artist_name || v.artist_name || meta.artist_name || 'Creator',
    artist_id: artistId,
    thumbnail_url: v.thumbnail_path || v.thumbnail_url || meta.thumbnail_url || '',
    preview_url: sanitizeMediaUrl(rawPreviewUrl),
    video_url: sanitizeMediaUrl(rawVideoUrl),
    price_rwf: priceRwf,
    price_usd: priceUsd,
    is_free: isFree,
    views: Number(v.view_count ?? v.views ?? meta.view_count ?? meta.views ?? 0),
    likes: Number(v.like_count ?? v.likes ?? meta.like_count ?? meta.likes ?? 0),
    rating_avg: Number(v.rating_avg ?? meta.rating_avg ?? 0),
    rating_count: Number(v.rating_count ?? meta.rating_count ?? 0),
    uploaded_at: uploadedAt,
    upload_date: uploadedAt,
    created_at: v.created_at || uploadedAt,
    duration: Number(v.duration_seconds ?? v.duration ?? meta.duration ?? 0),
    category: rawCategory,
    content_type: contentType,
    series_id: v.series_id || meta.series_id || null,
    series_title: v.series_title || meta.series_title || null,
    episode_number: v.episode_number ?? meta.episode_number ?? null,
    is_new: isNew,
    description: v.description || meta.description || '',
    is_short: isShort,
    visibility: v.visibility || 'public',
    tags,
    artists: {
      id: artist.id ? String(artist.id) : artistId,
      full_name: artist.full_name || artist.artist_name || v.artist_name || meta.artist_name || 'Creator',
      profile_image: artist.profile_image || artist.avatar_path || '',
      is_verified: Boolean(artist.is_verified),
      subscribers_count: Number(artist.subscribers_count || 0),
    },
  };
}

/**
 * Loads creator dictionary from live `artist_profiles`, `creator_channels`, and follow counts.
 */
async function getArtistsDictionary(): Promise<Record<string, any>> {
  const map: Record<string, any> = {};
  const client = rawSupabaseAdmin || supabaseAdmin;
  if (!client) return map;

  try {
    const [{ data: artists }, { data: channels }, { data: follows }] = await Promise.all([
      client
        .from('artist_profiles')
        .select('id, artist_name, avatar_path, verification_status, approval_status')
        .limit(200),
      client
        .from('creator_channels')
        .select('id, channel_name, avatar_path, verification_status, approval_status')
        .limit(200),
      client
        .from('artist_follows')
        .select('artist_id')
        .limit(5000),
    ]);

    const followCounts = new Map<string, number>();
    if (Array.isArray(follows)) {
      follows.forEach((f: any) => {
        if (f.artist_id) {
          const k = String(f.artist_id);
          followCounts.set(k, (followCounts.get(k) || 0) + 1);
        }
      });
    }

    if (Array.isArray(artists)) {
      artists.forEach((ap: any) => {
        const key = String(ap.id);
        map[key] = {
          id: key,
          full_name: ap.artist_name || 'Creator',
          profile_image: ap.avatar_path || '',
          is_verified: ap.verification_status === 'verified' || ap.approval_status === 'approved',
          subscribers_count: followCounts.get(key) || 0,
        };
      });
    }

    if (Array.isArray(channels)) {
      channels.forEach((ch: any) => {
        const key = String(ch.id);
        if (!map[key]) {
          map[key] = {
            id: key,
            full_name: ch.channel_name || 'Creator',
            profile_image: ch.avatar_path || '',
            is_verified: ch.verification_status === 'verified' || ch.approval_status === 'approved',
            subscribers_count: followCounts.get(key) || 0,
          };
        }
      });
    }
  } catch (err: any) {
    console.warn('[videoController] Artist dictionary load notice:', err?.message || err);
  }

  return map;
}

/**
 * Schema-safe live PostgreSQL video loader from `videos` table.
 */
async function loadActiveVideos(limit = 100): Promise<any[]> {
  const client = rawSupabaseAdmin || supabaseAdmin;
  if (!client) return [];

  const [artistsMap, { data, error }] = await Promise.all([
    getArtistsDictionary(),
    client
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (error) {
    throw error;
  }

  const activeRemote = (data || []).filter(
    (v: any) =>
      v.record_status !== 'deleted' &&
      v.moderation_status !== 'rejected' &&
      v.moderation_status !== 'blocked' &&
      (!v.visibility || v.visibility === 'public')
  );

  return activeRemote.map((v: any) => normalizeVideo(v, artistsMap));
}

async function invalidateVideoCaches(videoId?: string) {
  await Promise.all([
    cacheService.del('paytune:videos:trending'),
    cacheService.del('paytune:videos:new'),
    cacheService.del('paytune:videos:catalog:all'),
    videoId ? cacheService.del(`paytune:videos:related:${videoId}`) : Promise.resolve(),
  ]);
}

/**
 * GET /api/videos
 */
export const listVideos = async (req: Request, res: Response) => {
  const {
    category,
    type,
    sort = 'newest',
    q,
    limit = '20',
    offset = '0',
  } = req.query;

  const numLimit = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
  const numOffset = Math.max(0, parseInt(String(offset), 10) || 0);

  try {
    let catalog = await cacheService.get<any[]>('paytune:videos:catalog:all');
    if (!catalog) {
      catalog = await loadActiveVideos(200);
      await cacheService.set('paytune:videos:catalog:all', catalog, 45);
    }

    let list = [...catalog];

    if (category && category !== 'All') {
      const catStr = String(category).toLowerCase();
      if (catStr === 'shorts' || catStr === 'reels & shorts') {
        list = list.filter((v) => v.is_short || (v.category || '').toLowerCase().includes('short'));
      } else {
        list = list.filter((v) => (v.category || '').toLowerCase() === catStr);
      }
    }

    if (q) {
      const lowerQ = String(q).toLowerCase().trim();
      list = list.filter(
        (v) =>
          (v.title && v.title.toLowerCase().includes(lowerQ)) ||
          (v.artist_name && v.artist_name.toLowerCase().includes(lowerQ)) ||
          (v.category && v.category.toLowerCase().includes(lowerQ))
      );
    }

    if (type === 'free') {
      list = list.filter((v) => v.is_free === true);
    } else if (type === 'paid') {
      list = list.filter((v) => v.is_free === false);
    }

    switch (sort) {
      case 'most_purchased':
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'price_low_high':
        list.sort((a, b) => (a.price_rwf || 0) - (b.price_rwf || 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
        break;
      case 'newest':
      default:
        list.sort(
          (a, b) =>
            new Date(b.uploaded_at || b.created_at || 0).getTime() -
            new Date(a.uploaded_at || a.created_at || 0).getTime()
        );
        break;
    }

    res.json(list.slice(numOffset, numOffset + numLimit));
  } catch (error: any) {
    console.error('listVideos error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch videos' });
  }
};

/**
 * GET /api/videos/trending
 */
export const getTrendingVideos = async (_req: Request, res: Response) => {
  try {
    const cached = await cacheService.get<any[]>('paytune:videos:trending');
    if (cached) {
      return res.json(cached);
    }

    const videos = await loadActiveVideos(100);
    const trending = [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);

    await cacheService.set('paytune:videos:trending', trending, 60);
    res.json(trending);
  } catch (error: any) {
    console.error('getTrendingVideos error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch trending videos' });
  }
};

/**
 * GET /api/videos/new
 */
export const getNewVideos = async (_req: Request, res: Response) => {
  try {
    const cached = await cacheService.get<any[]>('paytune:videos:new');
    if (cached) {
      return res.json(cached);
    }

    const videos = await loadActiveVideos(100);
    const newest = [...videos]
      .sort(
        (a, b) =>
          new Date(b.uploaded_at || b.created_at || 0).getTime() -
          new Date(a.uploaded_at || a.created_at || 0).getTime()
      )
      .slice(0, 10);

    await cacheService.set('paytune:videos:new', newest, 60);
    res.json(newest);
  } catch (error: any) {
    console.error('getNewVideos error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch new releases' });
  }
};

/**
 * GET /api/videos/recommended
 */
export const getRecommendedVideos = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const client = rawSupabaseAdmin || supabaseAdmin;
    const purchasedVideoIds = new Set<string>();

    if (userId && client) {
      try {
        const { data: grants } = await client
          .from('premium_content_access_grants')
          .select('content_id')
          .eq('user_id', userId)
          .eq('content_type', 'video')
          .is('revoked_at', null);
        (grants || []).forEach((g: any) => {
          if (g.content_id) purchasedVideoIds.add(String(g.content_id));
        });
      } catch {
        // Non-fatal
      }
    }

    const candidates = await loadActiveVideos(100);
    const ordered = [...candidates]
      .filter((v) => !purchasedVideoIds.has(v.id))
      .sort((a, b) => {
        const scoreA = (a.rating_avg || 0) * 1000 + (a.views || 0);
        const scoreB = (b.rating_avg || 0) * 1000 + (b.views || 0);
        return scoreB - scoreA;
      });

    res.json(ordered.slice(0, 10));
  } catch (error: any) {
    console.error('getRecommendedVideos error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recommended videos' });
  }
};

/**
 * GET /api/videos/:id
 */
export const getVideoDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const userId = user?.id;
  const client = rawSupabaseAdmin || supabaseAdmin;

  try {
    const [artistsMap, { data: video, error }] = await Promise.all([
      getArtistsDictionary(),
      client.from('videos').select('*').eq('id', id).maybeSingle(),
    ]);

    if (error) throw error;
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const normalized = normalizeVideo(video, artistsMap);
    let userOwns = Boolean(normalized.is_short || normalized.is_free);
    let isMember = false;
    let minTier: any = null;
    let userLiked = false;
    let userSubscribed = false;
    let userRating = 0;
    let purchaseCount = 0;

    try {
      const [{ count }, { data: allRatings }] = await Promise.all([
        client
          .from('premium_content_access_grants')
          .select('id', { count: 'exact', head: true })
          .eq('content_type', 'video')
          .eq('content_id', id),
        client
          .from('content_ratings')
          .select('user_id, rating')
          .eq('content_type', 'video')
          .eq('content_id', id),
      ]);
      purchaseCount = count || 0;
      if (Array.isArray(allRatings) && allRatings.length > 0) {
        const sum = allRatings.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0);
        normalized.rating_count = allRatings.length;
        normalized.rating_avg = Number((sum / allRatings.length).toFixed(2));
        if (userId) {
          const mine = allRatings.find((r: any) => String(r.user_id) === String(userId));
          if (mine) userRating = Number(mine.rating || 0);
        }
      }
    } catch {
      purchaseCount = 0;
    }

    if (userId) {
      try {
        const { data: reaction } = await client
          .from('content_reactions')
          .select('id')
          .eq('user_id', userId)
          .eq('content_type', 'video')
          .eq('content_id', id)
          .eq('reaction_type', 'like')
          .maybeSingle();
        userLiked = Boolean(reaction);
      } catch {}

      if (normalized.artist_id) {
        try {
          const { data: followRec } = await client
            .from('artist_follows')
            .select('id')
            .eq('user_id', userId)
            .eq('artist_id', normalized.artist_id)
            .maybeSingle();
          userSubscribed = Boolean(followRec);
        } catch {}

        try {
          const { data: artistRec } = await client
            .from('artist_profiles')
            .select('id')
            .eq('id', normalized.artist_id)
            .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
            .maybeSingle();
          if (artistRec) userOwns = true;
        } catch {}
      }

      if (!userOwns) {
        if (user?.role === 'MASTER_ADMIN' || user?.role === 'master' || user?.role === 'admin') {
          userOwns = true;
        } else {
          try {
            const { data: grant } = await client
              .from('premium_content_access_grants')
              .select('id')
              .eq('user_id', userId)
              .eq('content_type', 'video')
              .eq('content_id', id)
              .is('revoked_at', null)
              .maybeSingle();
            if (grant) userOwns = true;
          } catch {}
        }
      }
    }

    if (!userOwns && !normalized.is_free) {
      normalized.video_url = normalized.preview_url || '';
    }

    res.json({
      ...normalized,
      userOwns,
      isMember,
      minTier,
      userLiked,
      userSubscribed,
      userRating,
      purchaseCount,
    });
  } catch (error: any) {
    console.error('getVideoDetails error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video details' });
  }
};

/**
 * GET /api/videos/:id/related
 */
export const getRelatedVideos = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const cacheKey = `paytune:videos:related:${id}`;
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = await loadActiveVideos(100);
    const currentVideo = pool.find((v) => String(v.id) === String(id)) || null;
    const filtered = pool.filter((v) => String(v.id) !== String(id));

    filtered.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (currentVideo) {
        if (currentVideo.series_id && a.series_id === currentVideo.series_id) scoreA += 250000;
        if (currentVideo.series_id && b.series_id === currentVideo.series_id) scoreB += 250000;
        if (a.artist_id && a.artist_id === currentVideo.artist_id) scoreA += 100000;
        if (b.artist_id && b.artist_id === currentVideo.artist_id) scoreB += 100000;
        if (a.category && a.category === currentVideo.category) scoreA += 25000;
        if (b.category && b.category === currentVideo.category) scoreB += 25000;
      }
      scoreA += a.views || 0;
      scoreB += b.views || 0;
      return scoreB - scoreA;
    });

    const result = filtered.slice(0, 12);
    await cacheService.set(cacheKey, result, 60);
    res.json(result);
  } catch (error: any) {
    console.error('getRelatedVideos error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch related videos' });
  }
};

/**
 * POST /api/videos/:id/like
 */
export const toggleVideoLike = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: video, error: vidErr } = await client
      .from('videos')
      .select('id, metadata')
      .eq('id', id)
      .maybeSingle();

    if (vidErr) throw vidErr;
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const { data: existingLike } = await client
      .from('content_reactions')
      .select('id')
      .eq('content_type', 'video')
      .eq('content_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', 'like')
      .maybeSingle();

    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};

    if (existingLike) {
      await client.from('content_reactions').delete().eq('id', existingLike.id);
    } else {
      await client.from('content_reactions').insert({
        content_type: 'video',
        content_id: id,
        user_id: user.id,
        reaction_type: 'like',
      });
    }

    const { count } = await client
      .from('content_reactions')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', 'video')
      .eq('content_id', id)
      .eq('reaction_type', 'like');

    const currentLikes = count ?? Math.max(0, Number(meta.like_count ?? meta.likes ?? 0) + (existingLike ? -1 : 1));
    await client
      .from('videos')
      .update({ metadata: { ...meta, like_count: currentLikes, likes: currentLikes }, updated_at: new Date().toISOString() })
      .eq('id', id);

    await invalidateVideoCaches(id);
    return res.json({ liked: !existingLike, likes: currentLikes });
  } catch (error: any) {
    console.error('toggleVideoLike error:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle like' });
  }
};

/**
 * POST /api/videos/:id/rate
 */
export const rateVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const stars = Math.round(Number(req.body?.rating));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: video, error: vidErr } = await client
      .from('videos')
      .select('id, metadata')
      .eq('id', id)
      .maybeSingle();

    if (vidErr) throw vidErr;
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const now = new Date().toISOString();
    const { data: existing } = await client
      .from('content_ratings')
      .select('id')
      .eq('content_type', 'video')
      .eq('content_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await client
        .from('content_ratings')
        .update({
          rating: stars,
          review_text: req.body?.review_text ?? null,
          is_edited: true,
          updated_at: now,
        })
        .eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await client
        .from('content_ratings')
        .insert({
          id: randomUUID(),
          content_type: 'video',
          content_id: id,
          user_id: user.id,
          rating: stars,
          review_text: req.body?.review_text ?? null,
          moderation_status: 'approved',
          is_edited: false,
          created_at: now,
          updated_at: now,
        });
      if (insErr) throw insErr;
    }

    const { data: ratingsRows } = await client
      .from('content_ratings')
      .select('rating')
      .eq('content_type', 'video')
      .eq('content_id', id);

    const list = ratingsRows || [];
    const ratingCount = list.length;
    const ratingAvg =
      ratingCount > 0
        ? Number((list.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / ratingCount).toFixed(2))
        : stars;

    const prevMeta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
    await client
      .from('videos')
      .update({
        metadata: { ...prevMeta, rating_avg: ratingAvg, rating_count: ratingCount },
        updated_at: now,
      })
      .eq('id', id);

    await invalidateVideoCaches(id);
    return res.json({
      success: true,
      userRating: stars,
      rating_avg: ratingAvg,
      rating_count: ratingCount,
    });
  } catch (error: any) {
    console.error('rateVideo error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save rating' });
  }
};

/**
 * POST /api/videos/:id/super-thanks
 */
export const sendVideoSuperThanks = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid positive amount is required' });
  }

  const providerRaw = String(req.body?.provider || req.body?.paymentMethod || 'MTN').toUpperCase();
  const isStripe = providerRaw.includes('STRIPE') || providerRaw.includes('CARD');
  const isAirtel = providerRaw.includes('AIRTEL');
  const hasGateway = isStripe
    ? Boolean(process.env.STRIPE_SECRET_KEY)
    : isAirtel
    ? Boolean(process.env.AIRTEL_CLIENT_ID && process.env.AIRTEL_CLIENT_SECRET)
    : Boolean(process.env.MTN_SUBSCRIPTION_KEY && process.env.MTN_API_USER && process.env.MTN_API_KEY);

  if (!hasGateway) {
    return res.status(503).json({
      provider_configured: false,
      error: 'Payment provider credentials are not configured. Super Thanks requires live MTN MoMo, Airtel Money, or Stripe keys.',
    });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: video, error: vidErr } = await client
      .from('videos')
      .select('id, creator_channel_id')
      .eq('id', id)
      .maybeSingle();

    if (vidErr) throw vidErr;
    if (!video || !video.creator_channel_id) {
      return res.status(404).json({ error: 'Video or creator channel not found' });
    }

    const now = new Date().toISOString();
    const txId = `STX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: donation, error: insErr } = await client
      .from('super_thanks')
      .insert({
        id: randomUUID(),
        creator_channel_id: video.creator_channel_id,
        sender_user_id: user.id,
        content_type: 'video',
        content_id: id,
        currency_code: String(req.body?.currency || 'RWF').toUpperCase(),
        amount,
        public_message: req.body?.message ? String(req.body.message).trim() : null,
        is_message_public: req.body?.isPublic !== false,
        event_status: 'pending',
        payment_provider: isStripe ? 'stripe' : isAirtel ? 'airtel_money' : 'mtn_momo',
        provider_payment_reference: txId,
        created_at: now,
        event_metadata: {
          payment_phone: req.body?.payment_phone || null,
          video_id: id,
        },
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return res.status(201).json({
      success: true,
      status: 'pending',
      transactionId: txId,
      donation,
    });
  } catch (error: any) {
    console.error('sendVideoSuperThanks error:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate Super Thanks' });
  }
};

/**
 * POST /api/videos/:id/view
 */
export const recordVideoView = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const client = rawSupabaseAdmin || supabaseAdmin;

  try {
    const { data: video, error } = await client
      .from('videos')
      .select('id, metadata')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
    const newViews = Number(meta.view_count ?? meta.views ?? 0) + 1;
    await client
      .from('videos')
      .update({ metadata: { ...meta, view_count: newViews, views: newViews }, updated_at: new Date().toISOString() })
      .eq('id', id);

    try {
      await client.from('video_view_events').insert({
        video_id: id,
        viewer_user_id: user?.id || null,
        occurred_at: new Date().toISOString(),
        validation_status: 'valid',
      });
    } catch {}

    await invalidateVideoCaches(id);
    res.json({ success: true, views: newViews });
  } catch (error: any) {
    console.error('recordVideoView error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/videos/:id/progress
 */
export const saveVideoProgress = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const rawPos = req.body.positionSeconds !== undefined ? req.body.positionSeconds : req.body.position_seconds;

  if (rawPos === undefined || isNaN(Number(rawPos))) {
    return res.status(400).json({ error: 'positionSeconds or position_seconds is required' });
  }

  const pos = Math.max(0, Math.floor(Number(rawPos)));
  if (!user) {
    return res.json({ success: true, positionSeconds: pos, savedLocally: true });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: existing } = await client
      .from('video_watch_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();

    if (existing) {
      await client
        .from('video_watch_history')
        .update({
          last_position_seconds: pos,
          last_watched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await client.from('video_watch_history').insert({
        user_id: user.id,
        video_id: id,
        last_position_seconds: pos,
        last_watched_at: new Date().toISOString(),
      });
    }

    res.json({ success: true, positionSeconds: pos });
  } catch (error: any) {
    console.error('saveVideoProgress error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/videos/:id/progress
 */
export const getVideoProgress = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user) {
    return res.json({ positionSeconds: 0 });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: progress } = await client
      .from('video_watch_history')
      .select('last_position_seconds')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();

    res.json({ positionSeconds: progress?.last_position_seconds || 0 });
  } catch (error: any) {
    console.error('getVideoProgress error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/videos/:id/subscribe
 */
export const toggleArtistSubscribe = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required to follow creator' });
  }

  const client = rawSupabaseAdmin || supabaseAdmin;
  try {
    const { data: vid } = await client
      .from('videos')
      .select('artist_profile_id')
      .eq('id', id)
      .maybeSingle();

    const artistProfileId = vid?.artist_profile_id || id;

    const { data: existing } = await client
      .from('artist_follows')
      .select('id')
      .eq('user_id', user.id)
      .eq('artist_id', artistProfileId)
      .maybeSingle();

    if (existing) {
      await client.from('artist_follows').delete().eq('id', existing.id);
      const { count } = await client
        .from('artist_follows')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistProfileId);
      return res.json({ subscribed: false, subscribers_count: count || 0 });
    } else {
      await client.from('artist_follows').insert({
        user_id: user.id,
        artist_id: artistProfileId,
      });
      const { count } = await client
        .from('artist_follows')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artistProfileId);
      return res.json({ subscribed: true, subscribers_count: count || 0 });
    }
  } catch (error: any) {
    console.error('toggleArtistSubscribe error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/videos/feed/personalized
 */
export const getPersonalizedFeed = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const client = rawSupabaseAdmin || supabaseAdmin;
    const artistsMap = await getArtistsDictionary();

    const userSubscribedArtistIds = new Set<string>();
    const purchasedVideoIds = new Set<string>();
    const watchHistoryMap = new Map<string, any>();

    if (userId && client) {
      const [{ data: follows }, { data: grants }, { data: history }] = await Promise.all([
        client.from('artist_follows').select('artist_id').eq('user_id', userId),
        client
          .from('premium_content_access_grants')
          .select('content_id')
          .eq('user_id', userId)
          .eq('content_type', 'video')
          .is('revoked_at', null),
        client
          .from('video_watch_history')
          .select('video_id, last_position_seconds, is_completed')
          .eq('user_id', userId),
      ]);

      (follows || []).forEach((f: any) => {
        if (f.artist_id) userSubscribedArtistIds.add(String(f.artist_id));
      });
      (grants || []).forEach((g: any) => {
        if (g.content_id) purchasedVideoIds.add(String(g.content_id));
      });
      (history || []).forEach((h: any) => {
        if (h.video_id) watchHistoryMap.set(String(h.video_id), h);
      });
    }

    const activeVideos = await loadActiveVideos(200);

    const continueWatchingList: any[] = [];
    if (userId && watchHistoryMap.size > 0) {
      activeVideos.forEach((v) => {
        const prog = watchHistoryMap.get(v.id);
        if (prog && prog.last_position_seconds > 5 && !prog.is_completed) {
          const duration = v.duration || 0;
          continueWatchingList.push({
            ...v,
            position_seconds: prog.last_position_seconds,
            progress_percent: duration > 0 ? Math.min(100, Math.round((prog.last_position_seconds / duration) * 100)) : 0,
          });
        }
      });
    }

    const now = Date.now();
    const scoredVideos = activeVideos.map((video) => {
      let score = Math.log(Math.max(1, video.views || 0)) * 5 + (video.likes || 0) * 3;
      if (userSubscribedArtistIds.has(String(video.artist_id))) score += 40;
      const uploadTime = new Date(video.uploaded_at || video.created_at || 0).getTime();
      const ageHours = Math.max(0, (now - uploadTime) / (1000 * 60 * 60));
      if (ageHours < 168) score += Math.max(0, 30 * (1 - ageHours / 168));
      return { video, score };
    });

    scoredVideos.sort((a, b) => b.score - a.score);
    const forYouVideos = scoredVideos.map((sv) => sv.video).slice(0, 16);

    const fromYourChannels =
      userSubscribedArtistIds.size > 0
        ? activeVideos.filter((v) => userSubscribedArtistIds.has(String(v.artist_id))).slice(0, 8)
        : [];

    const trending = [...activeVideos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    const newReleases = [...activeVideos]
      .sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime())
      .slice(0, 10);
    const recommendedShorts = activeVideos.filter((v) => v.is_short).slice(0, 8);
    const purchasedVideos =
      userId && purchasedVideoIds.size > 0
        ? activeVideos.filter((v) => purchasedVideoIds.has(String(v.id)))
        : [];

    // Live streams queried strictly from PostgreSQL livestreams table
    const { data: liveRows } = await client
      .from('livestreams')
      .select('*')
      .in('stream_status', ['live', 'scheduled'])
      .order('scheduled_start_at', { ascending: true })
      .limit(20);

    const liveNow = (liveRows || [])
      .filter((s: any) => s.stream_status === 'live')
      .map((s: any) => {
        const artist = artistsMap[String(s.artist_profile_id || s.creator_channel_id || '')] || {
          full_name: 'Creator',
          profile_image: '',
        };
        return {
          ...s,
          status: s.stream_status,
          artist_name: artist.full_name,
          artist_avatar: artist.profile_image || s.metadata?.thumbnail_url || '',
        };
      });

    const upcomingLive = (liveRows || [])
      .filter((s: any) => s.stream_status === 'scheduled')
      .map((s: any) => {
        const artist = artistsMap[String(s.artist_profile_id || s.creator_channel_id || '')] || {
          full_name: 'Creator',
          profile_image: '',
        };
        return {
          ...s,
          status: s.stream_status,
          scheduled_start: s.scheduled_start_at || s.created_at,
          artist_name: artist.full_name,
          artist_avatar: artist.profile_image || s.metadata?.thumbnail_url || '',
          is_reminded: false,
        };
      });

    return res.json({
      success: true,
      userInterests: [],
      hasInterests: false,
      feed: {
        forYou: forYouVideos,
        continueWatching: continueWatchingList,
        fromYourChannels,
        liveNow,
        upcomingLive,
        trending,
        newReleases,
        recommendedShorts,
        purchasedVideos,
      },
    });
  } catch (error: any) {
    console.error('getPersonalizedFeed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate personalized feed.' });
  }
};
