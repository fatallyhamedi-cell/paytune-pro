import { Request, Response } from 'express';
import { getTableData, saveTableData } from '../config/supabase_mock';

export const getHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  try {
    const profiles = getTableData('profiles');
    const profile = profiles.find((p: any) => p.id === user.id);
    const isPaused = !!profile?.pause_history;

    const historyEntries = getTableData('watch_history').filter((h: any) => h.user_id === user.id);
    const allVideos = getTableData('videos');
    const artists = getTableData('artists');

    // Sort newest watched first
    historyEntries.sort((a: any, b: any) => {
      return new Date(b.last_watched_at || 0).getTime() - new Date(a.last_watched_at || 0).getTime();
    });

    const enriched = historyEntries.map((h: any) => {
      const video = allVideos.find((v: any) => v.id === h.video_id);
      if (!video) return null;
      const artist = artists.find((a: any) => a.id === video.artist_id);

      return {
        id: h.id || `hist-${video.id}`,
        video_id: video.id,
        title: video.title,
        artist_id: video.artist_id,
        artist_name: artist?.full_name || 'Rwandan Artist',
        thumbnail_url: video.thumbnail_url || '',
        video_url: video.video_url,
        position_seconds: h.position_seconds || 0,
        duration: video.duration || h.duration || 240,
        completed: !!h.completed,
        last_watched_at: h.last_watched_at || new Date().toISOString()
      };
    }).filter(Boolean);

    const total = enriched.length;
    const paginated = enriched.slice(offset, offset + limit);

    res.json({
      items: paginated,
      total,
      limit,
      offset,
      is_paused: isPaused
    });
  } catch (err: any) {
    console.error('getHistory error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const removeHistoryItem = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;

  try {
    const history = getTableData('watch_history');
    const filtered = history.filter((h: any) => !(h.user_id === user.id && (h.video_id === videoId || h.id === videoId)));

    saveTableData('watch_history', filtered);
    res.json({ success: true, message: 'Item removed from watch history.' });
  } catch (err: any) {
    console.error('removeHistoryItem error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const clearHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const history = getTableData('watch_history');
    const filtered = history.filter((h: any) => h.user_id !== user.id);

    saveTableData('watch_history', filtered);
    res.json({ success: true, message: 'Watch history cleared successfully.' });
  } catch (err: any) {
    console.error('clearHistory error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const pauseHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { paused } = req.body;

  try {
    const profiles = getTableData('profiles');
    let profile = profiles.find((p: any) => p.id === user.id);

    const targetPaused = paused !== undefined ? !!paused : !(profile?.pause_history);

    if (profile) {
      profile.pause_history = targetPaused;
    } else {
      profile = {
        id: user.id,
        email: user.email,
        full_name: 'Paytune User',
        pause_history: targetPaused
      };
      profiles.push(profile);
    }

    saveTableData('profiles', profiles);

    res.json({
      success: true,
      message: targetPaused ? 'Watch history has been paused.' : 'Watch history recording resumed.',
      is_paused: targetPaused
    });
  } catch (err: any) {
    console.error('pauseHistory error:', err);
    res.status(500).json({ error: err.message });
  }
};
