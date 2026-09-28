import { Request, Response } from 'express';
import { getTableData, saveTableData } from '../config/supabase_mock';

export const getUserPlaylists = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const playlists = getTableData('playlists').filter((p: any) => p.user_id === user.id);
    const playlistVideos = getTableData('playlist_videos');
    const allVideos = getTableData('videos');
    const artists = getTableData('artists');

    const enriched = playlists.map((pl: any) => {
      const pvs = playlistVideos
        .filter((pv: any) => pv.playlist_id === pl.id)
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

      const videos = pvs.map((pv: any) => {
        const video = allVideos.find((v: any) => v.id === pv.video_id);
        if (!video) return null;
        const artist = artists.find((a: any) => a.id === video.artist_id);
        return {
          id: video.id,
          title: video.title,
          artist_id: video.artist_id,
          artist_name: artist?.full_name || 'Rwandan Artist',
          thumbnail_url: video.thumbnail_url,
          duration: video.duration || 200,
          category: video.category,
          price_rwf: video.price_rwf,
          price_usd: video.price_usd,
          added_at: pv.added_at
        };
      }).filter(Boolean);

      const defaultThumbnail = videos.length > 0 && videos[0]?.thumbnail_url
        ? videos[0].thumbnail_url
        : (pl.thumbnail_url || '');

      return {
        id: pl.id,
        user_id: pl.user_id,
        name: pl.name || pl.title || 'Untitled Playlist',
        title: pl.title || pl.name || 'Untitled Playlist',
        description: pl.description || '',
        thumbnail_url: defaultThumbnail,
        video_count: videos.length,
        is_public: pl.is_public !== false,
        created_at: pl.created_at || new Date().toISOString(),
        updated_at: pl.updated_at || pl.created_at || new Date().toISOString(),
        videos
      };
    });

    res.json(enriched);
  } catch (err: any) {
    console.error('getUserPlaylists error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getPlaylistDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const playlists = getTableData('playlists');
    const pl = playlists.find((p: any) => p.id === id);

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // If private, ensure current user owns it
    if (pl.is_public === false && (!user || user.id !== pl.user_id)) {
      return res.status(403).json({ error: 'This playlist is private.' });
    }

    const playlistVideos = getTableData('playlist_videos')
      .filter((pv: any) => pv.playlist_id === id)
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

    const allVideos = getTableData('videos');
    const artists = getTableData('artists');

    const videos = playlistVideos.map((pv: any) => {
      const video = allVideos.find((v: any) => v.id === pv.video_id);
      if (!video) return null;
      const artist = artists.find((a: any) => a.id === video.artist_id);
      return {
        id: video.id,
        title: video.title,
        artist_id: video.artist_id,
        artist_name: artist?.full_name || 'Rwandan Artist',
        thumbnail_url: video.thumbnail_url,
        video_url: video.video_url,
        duration: video.duration || 200,
        category: video.category,
        price_rwf: video.price_rwf,
        price_usd: video.price_usd,
        added_at: pv.added_at,
        order_index: pv.order_index
      };
    }).filter(Boolean);

    const defaultThumbnail = videos.length > 0 && videos[0]?.thumbnail_url
      ? videos[0].thumbnail_url
      : (pl.thumbnail_url || '');

    res.json({
      id: pl.id,
      user_id: pl.user_id,
      name: pl.name || pl.title || 'Untitled Playlist',
      title: pl.title || pl.name || 'Untitled Playlist',
      description: pl.description || '',
      thumbnail_url: defaultThumbnail,
      video_count: videos.length,
      is_public: pl.is_public !== false,
      created_at: pl.created_at || new Date().toISOString(),
      updated_at: pl.updated_at || pl.created_at || new Date().toISOString(),
      videos
    });
  } catch (err: any) {
    console.error('getPlaylistDetails error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const createPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, title, description, is_public } = req.body;
  const playlistName = (name || title || '').trim();

  if (!playlistName) {
    return res.status(400).json({ error: 'Playlist name is required.' });
  }

  try {
    const playlists = getTableData('playlists');
    const newPlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: user.id,
      name: playlistName,
      title: playlistName,
      description: (description || '').trim(),
      thumbnail_url: '',
      video_count: 0,
      is_public: is_public !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    playlists.push(newPlaylist);
    saveTableData('playlists', playlists);

    res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist: { ...newPlaylist, videos: [] }
    });
  } catch (err: any) {
    console.error('createPlaylist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { name, title, description, is_public } = req.body;

  try {
    const playlists = getTableData('playlists');
    const idx = playlists.findIndex((p: any) => p.id === id && p.user_id === user.id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Playlist not found or permission denied.' });
    }

    const updatedName = (name || title || playlists[idx].name || playlists[idx].title).trim();
    playlists[idx] = {
      ...playlists[idx],
      name: updatedName,
      title: updatedName,
      description: description !== undefined ? description.trim() : playlists[idx].description,
      is_public: is_public !== undefined ? is_public : playlists[idx].is_public,
      updated_at: new Date().toISOString()
    };

    saveTableData('playlists', playlists);

    res.json({
      success: true,
      message: 'Playlist updated successfully',
      playlist: playlists[idx]
    });
  } catch (err: any) {
    console.error('updatePlaylist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deletePlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const playlists = getTableData('playlists');
    const exists = playlists.some((p: any) => p.id === id && p.user_id === user.id);

    if (!exists) {
      return res.status(404).json({ error: 'Playlist not found or permission denied.' });
    }

    const filteredPlaylists = playlists.filter((p: any) => p.id !== id);
    saveTableData('playlists', filteredPlaylists);

    // Also remove associated playlist_videos
    const playlistVideos = getTableData('playlist_videos');
    const filteredVideos = playlistVideos.filter((pv: any) => pv.playlist_id !== id);
    saveTableData('playlist_videos', filteredVideos);

    res.json({ success: true, message: 'Playlist deleted successfully.' });
  } catch (err: any) {
    console.error('deletePlaylist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const addVideoToPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required.' });
  }

  try {
    const playlists = getTableData('playlists');
    const pl = playlists.find((p: any) => p.id === id && p.user_id === user.id);

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    const playlistVideos = getTableData('playlist_videos');
    const alreadyExists = playlistVideos.some((pv: any) => pv.playlist_id === id && pv.video_id === videoId);

    if (alreadyExists) {
      return res.status(200).json({ success: true, alreadyIn: true, message: 'Video is already in this playlist.' });
    }

    const currentCount = playlistVideos.filter((pv: any) => pv.playlist_id === id).length;
    const newEntry = {
      id: `pv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playlist_id: id,
      video_id: videoId,
      order_index: currentCount,
      added_at: new Date().toISOString()
    };

    playlistVideos.push(newEntry);
    saveTableData('playlist_videos', playlistVideos);

    // Update playlist count and thumbnail
    const allVideos = getTableData('videos');
    const targetVideo = allVideos.find((v: any) => v.id === videoId);
    if (targetVideo && targetVideo.thumbnail_url && !pl.thumbnail_url) {
      pl.thumbnail_url = targetVideo.thumbnail_url;
    }
    pl.video_count = currentCount + 1;
    pl.updated_at = new Date().toISOString();
    saveTableData('playlists', playlists);

    res.json({ success: true, message: 'Video added to playlist', entry: newEntry });
  } catch (err: any) {
    console.error('addVideoToPlaylist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const removeVideoFromPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id, videoId } = req.params;

  try {
    const playlists = getTableData('playlists');
    const pl = playlists.find((p: any) => p.id === id && p.user_id === user.id);

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    const playlistVideos = getTableData('playlist_videos');
    const filtered = playlistVideos.filter((pv: any) => !(pv.playlist_id === id && pv.video_id === videoId));

    saveTableData('playlist_videos', filtered);

    // Update count
    pl.video_count = filtered.filter((pv: any) => pv.playlist_id === id).length;
    pl.updated_at = new Date().toISOString();
    saveTableData('playlists', playlists);

    res.json({ success: true, message: 'Video removed from playlist.' });
  } catch (err: any) {
    console.error('removeVideoFromPlaylist error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const reorderVideos = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { videoIds } = req.body;

  if (!Array.isArray(videoIds)) {
    return res.status(400).json({ error: 'videoIds must be an array of string IDs.' });
  }

  try {
    const playlists = getTableData('playlists');
    const pl = playlists.find((p: any) => p.id === id && p.user_id === user.id);

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    const playlistVideos = getTableData('playlist_videos');
    
    // Update order_index for each video in this playlist
    videoIds.forEach((vid: string, index: number) => {
      const pv = playlistVideos.find((item: any) => item.playlist_id === id && item.video_id === vid);
      if (pv) {
        pv.order_index = index;
      }
    });

    saveTableData('playlist_videos', playlistVideos);

    res.json({ success: true, message: 'Playlist reordered successfully.' });
  } catch (err: any) {
    console.error('reorderVideos error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getShareLink = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const playlists = getTableData('playlists');
    const pl = playlists.find((p: any) => p.id === id);

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'paytune.com';
    const shareUrl = `${protocol}://${host}/playlist/${id}`;

    res.json({
      playlistId: id,
      title: pl.title || pl.name,
      shareUrl,
      isPublic: pl.is_public !== false
    });
  } catch (err: any) {
    console.error('getShareLink error:', err);
    res.status(500).json({ error: err.message });
  }
};
