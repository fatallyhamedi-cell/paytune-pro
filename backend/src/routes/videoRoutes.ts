import express from 'express';
import { supabase } from '../config/supabase';

const router = express.Router();

// GET /api/videos
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const category = req.query.category as string | undefined;

    let query = supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, video_url, audio_url, price_rwf, price_usd, is_free, is_short, views, likes, rating_avg, duration, category, visibility, uploaded_at, artist_id, artists(id, full_name, avatar_url)', { count: 'exact' })
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ videos: data || [], total: count || (data?.length ?? 0) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/trending
router.get('/trending', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, video_url, audio_url, price_rwf, price_usd, is_free, is_short, views, likes, rating_avg, duration, category, visibility, uploaded_at, artist_id, artists(id, full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ videos: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/new
router.get('/new', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, video_url, audio_url, price_rwf, price_usd, is_free, is_short, views, likes, rating_avg, duration, category, visibility, uploaded_at, artist_id, artists(id, full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ videos: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/recommended
router.get('/recommended', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, video_url, audio_url, price_rwf, price_usd, is_free, is_short, views, likes, rating_avg, duration, category, visibility, uploaded_at, artist_id, artists(id, full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ videos: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/:id/related — Related videos
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, video_url, audio_url, price_rwf, price_usd, is_free, is_short, views, likes, rating_avg, duration, category, visibility, uploaded_at, artist_id, artists(id, full_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .neq('id', id)
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/:id  — Specific video detail endpoint
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId || null;

    const { data: video, error } = await supabase
      .from('videos')
      .select('*, artists(id, full_name, avatar_url, follower_count)')
      .eq('id', id)
      .maybeSingle();

    if (error || !video) {
      return res.status(404).json({ error: 'Video not found', id });
    }

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/videos/:id/view — Increment view count
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await supabase.rpc('increment_video_views', { video_uuid: id });
    } catch {
      // Fallback update if RPC not present in postgres
      const { data: current } = await supabase.from('videos').select('views').eq('id', id).maybeSingle();
      const currentViews = Number(current?.views) || 0;
      await supabase.from('videos').update({ views: currentViews + 1 }).eq('id', id);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
