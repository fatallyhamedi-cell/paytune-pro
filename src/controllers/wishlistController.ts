import { Request, Response } from 'express';
import { getTableData, saveTableData } from '../config/supabase_mock';

export const getWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const wishlist = getTableData('wishlist').filter((w: any) => w.user_id === user.id);
    const allVideos = getTableData('videos');
    const artists = getTableData('artists');

    const enriched = wishlist.map((w: any) => {
      const video = allVideos.find((v: any) => v.id === w.video_id);
      if (!video) return null;
      const artist = artists.find((a: any) => a.id === video.artist_id);

      return {
        id: w.id || `wish-${video.id}`,
        video_id: video.id,
        title: video.title,
        artist_id: video.artist_id,
        artist_name: artist?.full_name || 'Rwandan Artist',
        thumbnail_url: video.thumbnail_url || '',
        video_url: video.video_url,
        price_rwf: video.price_rwf,
        price_usd: video.price_usd,
        duration: video.duration || 200,
        category: video.category || 'Afrobeat',
        created_at: w.created_at || new Date().toISOString()
      };
    }).filter(Boolean);

    res.json(enriched);
  } catch (err: any) {
    console.error('getWishlist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const addToWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;

  try {
    const wishlist = getTableData('wishlist');
    const exists = wishlist.some((w: any) => w.user_id === user.id && w.video_id === videoId);

    if (exists) {
      return res.json({ success: true, alreadyIn: true, message: 'Already saved to Watch Later.' });
    }

    const newEntry = {
      id: `wish-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: user.id,
      video_id: videoId,
      created_at: new Date().toISOString()
    };

    wishlist.push(newEntry);
    saveTableData('wishlist', wishlist);

    res.status(201).json({ success: true, message: 'Saved to Watch Later', entry: newEntry });
  } catch (err: any) {
    console.error('addToWishlist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;

  try {
    const wishlist = getTableData('wishlist');
    const filtered = wishlist.filter((w: any) => !(w.user_id === user.id && (w.video_id === videoId || w.id === videoId)));

    saveTableData('wishlist', filtered);
    res.json({ success: true, message: 'Removed from Watch Later.' });
  } catch (err: any) {
    console.error('removeFromWishlist error:', err);
    res.status(500).json({ error: err.message });
  }
};
