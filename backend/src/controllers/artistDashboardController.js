const { supabase, supabaseAdmin } = require('../config/supabase');

const db = supabaseAdmin || supabase;

/**
 * GET /api/artist/dashboard
 * Real PostgreSQL/Supabase dashboard summary using artist_profiles, creator_channels, videos, creator_earning_accounts.
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.artistUserId || req.user?.id;
    const artistIdParam = req.artistId || req.artist?.id;

    let artist = null;
    if (artistIdParam) {
      const { data } = await db.from('artist_profiles').select('*').eq('id', artistIdParam).maybeSingle();
      if (data) artist = data;
    }
    if (!artist && userId) {
      const { data } = await db
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
        .maybeSingle();
      if (data) artist = data;
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist profile not found in database.' });
    }

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id || userId;
    const { data: channel } = await db
      .from('creator_channels')
      .select('id')
      .or(`owner_user_id.eq.${ownerId},created_by_user_id.eq.${ownerId}`)
      .maybeSingle();

    const { data: vData, error: vErr } = await db
      .from('videos')
      .select('id, title, is_free, metadata, created_at, published_at')
      .eq('artist_profile_id', artist.id)
      .order('created_at', { ascending: false });
    if (vErr) throw vErr;

    const videos = vData || [];
    const formattedVideos = videos.map((v) => {
      const meta = (v.metadata && typeof v.metadata === 'object') ? v.metadata : {};
      return {
        id: v.id,
        title: v.title || 'Untitled',
        views: Number(meta.views_count || meta.view_count || 0),
        price_rwf: Number(meta.price_rwf || 0),
        price_usd: Number(meta.price_usd || 0),
        is_free: !!v.is_free,
        thumbnail_url: meta.thumbnail_url || '',
        uploaded_at: v.published_at || v.created_at
      };
    });

    const totalViews = formattedVideos.reduce((sum, v) => sum + v.views, 0);
    const totalVideos = formattedVideos.length;

    let balance = 0;
    let pendingBalance = 0;
    let totalEarned = 0;
    if (channel?.id) {
      const { data: acct } = await db
        .from('creator_earning_accounts')
        .select('available_balance, pending_balance, settled_total')
        .eq('creator_channel_id', channel.id)
        .maybeSingle();
      if (acct) {
        balance = Number(acct.available_balance || 0);
        pendingBalance = Number(acct.pending_balance || 0);
        totalEarned = balance + pendingBalance + Number(acct.settled_total || 0);
      }
    }

    const { count: followersCount } = await db
      .from('artist_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('artist_id', artist.id);

    return res.json({
      balance,
      totalVideos,
      totalViews,
      videos: formattedVideos,
      stats: {
        total_videos: totalVideos,
        total_views: totalViews,
        total_earnings: totalEarned,
        current_balance: balance,
        pending_balance: pendingBalance,
        total_followers: followersCount || 0,
        total_purchases: 0
      },
      artist: {
        id: artist.id,
        full_name: artist.artist_name || '',
        avatar_url: artist.avatar_path || '',
        banner_url: artist.banner_path || '',
        is_approved: artist.approval_status === 'approved',
        country_code: artist.country_code || 'RW'
      }
    });
  } catch (err) {
    console.error('[artistDashboardController] error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load artist dashboard' });
  }
};
