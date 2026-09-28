/**
 * Video controller implementing MySQL2 pool queries and endpoints
 */
const { getMysqlPool } = require('../src/config/mysql');
const { supabaseAdmin } = require('../src/config/supabase');
const { getDbStore } = require('../src/config/supabase_mock');

function normalizeVideo(v) {
  const isShort = v.is_short || v.category === 'Shorts' || v.category === 'Reels';
  const isFree = isShort ? true : (v.is_free === true || !v.price_rwf);
  return {
    id: String(v.id),
    title: v.title || "Untitled Video",
    artist_name: v.artist_name || v.artists?.full_name || "PAYTUNE Artist",
    artist_id: String(v.artist_id || "artist-1"),
    thumbnail_url: v.thumbnail_url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
    preview_url: v.preview_url || v.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    price_rwf: isShort ? 0 : (isFree ? 0 : (v.price_rwf || 500)),
    price_usd: isShort ? 0 : (isFree ? 0 : (v.price_usd || 0.50)),
    is_free: isFree,
    views: Number(v.views || 0),
    rating_avg: Number(v.rating_avg || 4.8),
    uploaded_at: v.uploaded_at || v.created_at || new Date().toISOString()
  };
}

async function listVideos(req, res) {
  const { category, sort = 'newest', limit = 20, offset = 0, q } = req.query;
  const numLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const numOffset = Math.max(0, parseInt(offset, 10) || 0);

  try {
    const pool = await getMysqlPool();
    if (pool) {
      try {
        let sql = `SELECT * FROM videos WHERE 1=1`;
        const params = [];
        if (category && category !== 'All') {
          sql += ` AND category = ?`;
          params.push(category);
        }
        if (q) {
          sql += ` AND title LIKE ?`;
          params.push(`%${q}%`);
        }
        switch (sort) {
          case 'most_purchased': sql += ` ORDER BY views DESC`; break;
          case 'price_low_high': sql += ` ORDER BY price_rwf ASC`; break;
          case 'rating': sql += ` ORDER BY rating_avg DESC`; break;
          case 'newest':
          default: sql += ` ORDER BY uploaded_at DESC`; break;
        }
        sql += ` LIMIT ? OFFSET ?`;
        params.push(numLimit, numOffset);

        const [rows] = await pool.query(sql, params);
        if (Array.isArray(rows)) {
          return res.json(rows.map(normalizeVideo));
        }
      } catch (err) {
        // Fallback to store
      }
    }

    const allStore = getDbStore()?.videos || [];
    let list = allStore.filter(v => (v.is_active !== false));
    if (category && category !== 'All') {
      list = list.filter(v => v.category === category);
    }
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(v => v.title && v.title.toLowerCase().includes(lq));
    }
    switch (sort) {
      case 'most_purchased': list.sort((a, b) => (b.views || 0) - (a.views || 0)); break;
      case 'price_low_high': list.sort((a, b) => (a.price_rwf || 0) - (b.price_rwf || 0)); break;
      case 'rating': list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)); break;
      case 'newest':
      default: list.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()); break;
    }

    const paged = list.slice(numOffset, numOffset + numLimit).map(normalizeVideo);
    res.json(paged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getTrendingVideos(req, res) {
  try {
    const allStore = getDbStore()?.videos || [];
    const list = [...allStore]
      .filter(v => v.is_active !== false)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map(normalizeVideo);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getNewVideos(req, res) {
  try {
    const allStore = getDbStore()?.videos || [];
    const list = [...allStore]
      .filter(v => v.is_active !== false)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .slice(0, 10)
      .map(normalizeVideo);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getRecommendedVideos(req, res) {
  try {
    const allStore = getDbStore()?.videos || [];
    const list = [...allStore]
      .filter(v => v.is_active !== false)
      .sort((a, b) => ((b.rating_avg || 4.5) * 1000 + (b.views || 0)) - ((a.rating_avg || 4.5) * 1000 + (a.views || 0)))
      .slice(0, 10)
      .map(normalizeVideo);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getVideoDetails(req, res) {
  try {
    const allStore = getDbStore()?.videos || [];
    const video = allStore.find(v => String(v.id) === String(req.params.id));
    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(normalizeVideo(video));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  listVideos,
  getTrendingVideos,
  getNewVideos,
  getRecommendedVideos,
  getVideoDetails
};
