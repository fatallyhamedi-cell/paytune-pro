const { supabase, supabaseAdmin } = require('../config/supabase');

const db = supabaseAdmin || supabase;

/**
 * GET /api/master/analytics
 * Returns total platform views, total videos count, and video analytics list sorted by views desc.
 */
exports.getMasterAnalytics = async (req, res) => {
  try {
    // 1. Fetch videos from Supabase
    let videos = [];
    let artists = [];

    try {
      const { data: vData } = await db
        .from('videos')
        .select('id, title, views, price_rwf, price_usd, is_free, thumbnail_url, uploaded_at, artist_id')
        .order('views', { ascending: false });
      if (vData) videos = vData;

      const { data: aData } = await db
        .from('artists')
        .select('id, full_name, username');
      if (aData) artists = aData;
    } catch (e) {
      console.warn('[masterController.js] DB read warning:', e);
    }

    // Fallback to mock store if DB is empty or disconnected
    if (!videos || videos.length === 0) {
      try {
        const { getDbStore } = require('../../src/config/supabase_mock');
        const store = getDbStore();
        if (store && store.videos) {
          videos = store.videos;
          artists = store.artists || [];
        }
      } catch (mockErr) {
        // Safe fallback
      }
    }

    // Artist name lookup map
    const artistMap = {};
    for (const a of artists || []) {
      artistMap[a.id] = a.full_name || a.username || 'Artist';
    }

    // Format and sort videos by views descending
    const formattedVideos = (videos || []).map((v) => {
      const artistName =
        v.artist_name ||
        v.artists?.full_name ||
        v.artist_profiles?.full_name ||
        artistMap[v.artist_id] ||
        'PAYTUNE Creator';

      return {
        id: v.id,
        title: v.title || 'Untitled Track',
        artist_id: v.artist_id,
        artist_name: artistName,
        views: Number(v.views || 0),
        price_rwf: Number(v.price_rwf || 0),
        price_usd: Number(v.price_usd || 0),
        is_free: !!v.is_free,
        thumbnail_url: v.thumbnail_url || '',
        uploaded_at: v.uploaded_at || v.created_at || new Date().toISOString()
      };
    }).sort((a, b) => b.views - a.views);

    const totalPlatformViews = formattedVideos.reduce((acc, v) => acc + (v.views || 0), 0);
    const totalVideos = formattedVideos.length;

    return res.json({
      totalPlatformViews,
      totalVideos,
      videos: formattedVideos
    });
  } catch (err) {
    console.error('[masterController.js] getMasterAnalytics error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch master analytics' });
  }
};
