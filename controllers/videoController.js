/**
 * Video controller backed exclusively by Supabase PostgreSQL (no MySQL)
 */
const { supabaseAdmin } = require('../src/config/supabase');

function normalizeVideo(v) {
  const meta = v?.metadata && typeof v.metadata === 'object' ? v.metadata : {};
  const isShort =
    Boolean(v.is_short) ||
    v.video_type === 'short' ||
    v.category === 'Shorts' ||
    v.category === 'Reels';
  const priceRwf = isShort ? 0 : Number(v.price_rwf ?? meta.price_rwf ?? 0);
  const priceUsd = isShort ? 0 : Number(v.price_usd ?? meta.price_usd ?? (priceRwf ? (priceRwf / 1300).toFixed(2) : 0));
  const isFree = isShort ? true : (v.is_free === true || priceRwf === 0);

  return {
    id: String(v.id),
    title: v.title || 'Untitled Video',
    artist_name: v.artist_name || meta.artist_name || v.artist_profiles?.artist_name || v.artists?.full_name || 'PAYTUNE Artist',
    artist_id: String(v.artist_profile_id || v.artist_id || v.creator_channel_id || ''),
    thumbnail_url: v.thumbnail_url || meta.thumbnail_url || '',
    preview_url: v.preview_url || meta.preview_url || v.video_url || meta.video_url || '',
    video_url: v.video_url || meta.video_url || v.preview_url || meta.preview_url || '',
    price_rwf: priceRwf,
    price_usd: priceUsd,
    is_free: isFree,
    views: Number(v.views ?? meta.views ?? 0),
    rating_avg: Number(v.rating_avg ?? meta.rating_avg ?? 4.8),
    uploaded_at: v.published_at || v.uploaded_at || v.created_at || new Date().toISOString(),
  };
}

async function fetchSupabaseVideos({ category, sort = 'newest', limit = 20, offset = 0, q }) {
  let query = supabaseAdmin.from('videos').select('*');
  if (q) query = query.ilike('title', `%${q}%`);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  let list = Array.isArray(data) ? data.map(normalizeVideo) : [];
  if (category && category !== 'All') {
    list = list.filter((v) => (v.category || '').toLowerCase() === String(category).toLowerCase());
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
    default:
      list.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }
  return list;
}

async function listVideos(req, res) {
  const { category, sort = 'newest', limit = 20, offset = 0, q } = req.query;
  const numLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const numOffset = Math.max(0, parseInt(offset, 10) || 0);

  try {
    const list = await fetchSupabaseVideos({ category, sort, limit: numLimit, offset: numOffset, q });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getTrendingVideos(req, res) {
  try {
    const list = await fetchSupabaseVideos({ sort: 'most_purchased', limit: 10, offset: 0 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getNewVideos(req, res) {
  try {
    const list = await fetchSupabaseVideos({ sort: 'newest', limit: 10, offset: 0 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getRecommendedVideos(req, res) {
  try {
    const list = await fetchSupabaseVideos({ sort: 'rating', limit: 10, offset: 0 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getVideoDetails(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !data) return res.status(404).json({ message: 'Video not found' });
    res.json(normalizeVideo(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  listVideos,
  getTrendingVideos,
  getNewVideos,
  getRecommendedVideos,
  getVideoDetails,
};
