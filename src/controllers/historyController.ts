import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

export const getHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  try {
    const client = db();

    const [{ data: privacy }, { data: rows, count, error }] = await Promise.all([
      client
        .from('user_privacy_settings')
        .select('allow_personalized_recommendations')
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('video_watch_history')
        .select('id, video_id, last_position_seconds, total_watch_seconds, last_watched_at, is_completed', { count: 'exact' })
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    if (error) throw error;
    const isPaused = privacy ? privacy.allow_personalized_recommendations === false : false;

    const historyRows = rows || [];
    if (historyRows.length === 0) {
      return res.json({ items: [], total: count || 0, limit, offset, is_paused: isPaused });
    }

    const videoIds = historyRows.map((h: any) => h.video_id).filter(Boolean);
    const { data: videos } = await client
      .from('videos')
      .select('id, title, creator_channel_id, artist_profile_id, duration_seconds, metadata')
      .in('id', videoIds);

    const artistIds = Array.from(new Set((videos || []).map((v: any) => v.artist_profile_id).filter(Boolean)));
    const channelIds = Array.from(new Set((videos || []).map((v: any) => v.creator_channel_id).filter(Boolean)));

    const [{ data: artists }, { data: channels }] = await Promise.all([
      artistIds.length > 0
        ? client.from('artist_profiles').select('id, artist_name').in('id', artistIds)
        : Promise.resolve({ data: [] as any[] }),
      channelIds.length > 0
        ? client.from('creator_channels').select('id, channel_name').in('id', channelIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const artistMap = new Map((artists || []).map((a: any) => [a.id, a.artist_name]));
    const channelMap = new Map((channels || []).map((c: any) => [c.id, c.channel_name]));
    const videoMap = new Map((videos || []).map((v: any) => [v.id, v]));

    const items = historyRows
      .map((h: any) => {
        const video: any = videoMap.get(h.video_id);
        if (!video) return null;
        const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
        return {
          id: h.id,
          video_id: video.id,
          title: video.title,
          artist_id: video.artist_profile_id || video.creator_channel_id,
          artist_name:
            artistMap.get(video.artist_profile_id) ||
            channelMap.get(video.creator_channel_id) ||
            meta.artist_name ||
            'Creator',
          thumbnail_url: meta.thumbnail_url || '',
          video_url: meta.video_url || '',
          position_seconds: Number(h.last_position_seconds || 0),
          duration: Number(video.duration_seconds || 0),
          completed: Boolean(h.is_completed),
          last_watched_at: h.last_watched_at,
        };
      })
      .filter(Boolean);

    return res.json({
      items,
      total: count || items.length,
      limit,
      offset,
      is_paused: isPaused,
    });
  } catch (err: any) {
    console.error('getHistory error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load watch history' });
  }
};

export const removeHistoryItem = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;

  try {
    const client = db();
    await client
      .from('video_watch_history')
      .delete()
      .eq('user_id', user.id)
      .or(`video_id.eq.${videoId},id.eq.${videoId}`);

    return res.json({ success: true, message: 'Item removed from watch history.' });
  } catch (err: any) {
    console.error('removeHistoryItem error:', err);
    return res.status(500).json({ error: err.message || 'Failed to remove watch history item' });
  }
};

export const clearHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = db();
    await client.from('video_watch_history').delete().eq('user_id', user.id);

    return res.json({ success: true, message: 'Watch history cleared successfully.' });
  } catch (err: any) {
    console.error('clearHistory error:', err);
    return res.status(500).json({ error: err.message || 'Failed to clear watch history' });
  }
};

export const pauseHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { paused } = req.body || {};

  try {
    const client = db();
    const { data: current } = await client
      .from('user_privacy_settings')
      .select('allow_personalized_recommendations')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentlyPaused = current ? current.allow_personalized_recommendations === false : false;
    const targetPaused = paused !== undefined ? Boolean(paused) : !currentlyPaused;

    const { error } = await client
      .from('user_privacy_settings')
      .upsert(
        {
          user_id: user.id,
          allow_personalized_recommendations: !targetPaused,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    return res.json({
      success: true,
      message: targetPaused ? 'Watch history has been paused.' : 'Watch history recording resumed.',
      is_paused: targetPaused,
    });
  } catch (err: any) {
    console.error('pauseHistory error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update watch history preference' });
  }
};
