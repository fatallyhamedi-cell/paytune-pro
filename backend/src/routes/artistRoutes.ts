import express from 'express';
import { supabase } from '../config/supabase';

const router = express.Router();

// Simple in-memory cache for 30 seconds
let artistsCache: { data: any; expires: number } | null = null;

// GET /api/artists
router.get('/', async (_req, res) => {
  try {
    if (artistsCache && Date.now() < artistsCache.expires) {
      return res.json(artistsCache.data);
    }

    const { data, error } = await supabase
      .from('artists')
      .select('id, full_name, username, avatar_url, follower_count, is_verified, bio')
      .eq('is_approved', true)
      .eq('is_blocked', false)
      .order('follower_count', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    const responsePayload = { artists: data || [] };
    artistsCache = { data: responsePayload, expires: Date.now() + 30 * 1000 };
    return res.json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/artists/:id  — public artist profile
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('artists')
      .select('id, full_name, username, avatar_url, banner_url, bio, follower_count, is_verified, total_views')
      .eq('id', req.params.id)
      .eq('is_approved', true)
      .maybeSingle();

    if (error || !data) return res.status(404).json({ error: 'Artist not found' });
    return res.json({ artist: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/artists/:id/videos
router.get('/:id/videos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, video_url, audio_url, views, likes, price_rwf, price_usd, is_free, is_short, uploaded_at')
      .eq('artist_id', req.params.id)
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ videos: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
