const { supabase, supabaseAdmin } = require('../config/supabase');

const db = supabaseAdmin || supabase;

/**
 * GET /api/master/analytics
 * Real PostgreSQL/Supabase video analytics sorted by view count descending.
 */
exports.getMasterAnalytics = async (_req, res) => {
  try {
    const { data: vData, error: vErr } = await db
      .from('videos')
      .select('id, title, is_free, metadata, created_at, published_at, artist_profile_id, artist_profiles(id, artist_name), creator_channels(id, channel_name)')
      .order('created_at', { ascending: false });

    if (vErr) throw vErr;

    const formattedVideos = (vData || []).map((v) => {
      const meta = (v.metadata && typeof v.metadata === 'object') ? v.metadata : {};
      return {
        id: v.id,
        title: v.title || 'Untitled',
        artist_id: v.artist_profile_id,
        artist_name: v.artist_profiles?.artist_name || v.creator_channels?.channel_name || '',
        views: Number(meta.views_count || meta.view_count || 0),
        price_rwf: Number(meta.price_rwf || 0),
        price_usd: Number(meta.price_usd || 0),
        is_free: !!v.is_free,
        thumbnail_url: meta.thumbnail_url || '',
        uploaded_at: v.published_at || v.created_at
      };
    }).sort((a, b) => b.views - a.views);

    const totalPlatformViews = formattedVideos.reduce((acc, v) => acc + v.views, 0);

    return res.json({
      totalPlatformViews,
      totalVideos: formattedVideos.length,
      videos: formattedVideos
    });
  } catch (err) {
    console.error('[masterController.js] getMasterAnalytics error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch master analytics' });
  }
};
