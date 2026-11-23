import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

async function hydratePlaylistItems(playlistId: string) {
  const client = db();
  const { data: items, error } = await client
    .from('playlist_items')
    .select('id, content_type, content_id, position, added_at')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error) throw error;
  if (!items || items.length === 0) return [];

  const videoIds = items.map((i: any) => i.content_id).filter(Boolean);
  const { data: videos } = await client
    .from('videos')
    .select('id, title, creator_channel_id, artist_profile_id, duration_seconds, is_free, metadata')
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

  return items
    .map((pv: any) => {
      const video: any = videoMap.get(pv.content_id);
      if (!video) return null;
      const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
      return {
        id: video.id,
        title: video.title,
        artist_id: video.artist_profile_id || video.creator_channel_id,
        artist_name:
          artistMap.get(video.artist_profile_id) ||
          channelMap.get(video.creator_channel_id) ||
          meta.artist_name ||
          'Creator',
        thumbnail_url: meta.thumbnail_url || '',
        video_url: meta.video_url || '',
        duration: Number(video.duration_seconds || 0),
        category: meta.category || '',
        price_rwf: Number(meta.price_rwf || 0),
        price_usd: Number(meta.price_usd || 0),
        added_at: pv.added_at,
        order_index: pv.position,
      };
    })
    .filter(Boolean);
}

export const getUserPlaylists = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = db();
    const { data: playlists, error } = await client
      .from('playlists')
      .select('*')
      .eq('owner_user_id', user.id)
      .neq('playlist_type', 'system')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all(
      (playlists || []).map(async (pl: any) => {
        const videos = await hydratePlaylistItems(pl.id);
        const firstThumb = videos[0]?.thumbnail_url || '';
        return {
          id: pl.id,
          user_id: pl.owner_user_id,
          name: pl.title,
          title: pl.title,
          description: pl.description || '',
          thumbnail_url: firstThumb,
          video_count: videos.length,
          is_public: pl.visibility === 'public',
          visibility: pl.visibility,
          created_at: pl.created_at,
          updated_at: pl.updated_at,
          videos,
        };
      })
    );

    return res.json(enriched);
  } catch (err: any) {
    console.error('getUserPlaylists error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load playlists' });
  }
};

export const getPlaylistDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const client = db();
    const { data: pl, error } = await client
      .from('playlists')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    if (pl.visibility === 'private' && (!user || user.id !== pl.owner_user_id)) {
      return res.status(403).json({ error: 'This playlist is private.' });
    }

    const videos = await hydratePlaylistItems(pl.id);
    return res.json({
      id: pl.id,
      user_id: pl.owner_user_id,
      name: pl.title,
      title: pl.title,
      description: pl.description || '',
      thumbnail_url: videos[0]?.thumbnail_url || '',
      video_count: videos.length,
      is_public: pl.visibility === 'public',
      visibility: pl.visibility,
      created_at: pl.created_at,
      updated_at: pl.updated_at,
      videos,
    });
  } catch (err: any) {
    console.error('getPlaylistDetails error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load playlist' });
  }
};

export const createPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, title, description, is_public } = req.body || {};
  const playlistName = String(name || title || '').trim();
  if (!playlistName) {
    return res.status(400).json({ error: 'Playlist name is required.' });
  }

  try {
    const client = db();
    const slug = `${playlistName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}-${Date.now().toString(36)}`;
    const { data: pl, error } = await client
      .from('playlists')
      .insert({
        owner_user_id: user.id,
        title: playlistName,
        description: String(description || '').trim() || null,
        slug,
        playlist_type: 'personal',
        visibility: is_public === true ? 'public' : 'private',
      })
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist: {
        id: pl.id,
        user_id: pl.owner_user_id,
        name: pl.title,
        title: pl.title,
        description: pl.description || '',
        thumbnail_url: '',
        video_count: 0,
        is_public: pl.visibility === 'public',
        created_at: pl.created_at,
        updated_at: pl.updated_at,
        videos: [],
      },
    });
  } catch (err: any) {
    console.error('createPlaylist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create playlist' });
  }
};

export const updatePlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { name, title, description, is_public } = req.body || {};

  try {
    const client = db();
    const { data: existing } = await client
      .from('playlists')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Playlist not found or permission denied.' });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined || title !== undefined) {
      updates.title = String(name || title).trim();
    }
    if (description !== undefined) {
      updates.description = String(description).trim();
    }
    if (is_public !== undefined) {
      updates.visibility = is_public ? 'public' : 'private';
    }

    const { data: updated, error } = await client
      .from('playlists')
      .update(updates)
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Playlist updated successfully',
      playlist: {
        ...updated,
        name: updated.title,
        is_public: updated.visibility === 'public',
      },
    });
  } catch (err: any) {
    console.error('updatePlaylist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update playlist' });
  }
};

export const deletePlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const client = db();
    const { data: deleted, error } = await client
      .from('playlists')
      .delete()
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!deleted) {
      return res.status(404).json({ error: 'Playlist not found or permission denied.' });
    }

    return res.json({ success: true, message: 'Playlist deleted successfully.' });
  } catch (err: any) {
    console.error('deletePlaylist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete playlist' });
  }
};

export const addVideoToPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { videoId } = req.body || {};

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required.' });
  }

  try {
    const client = db();
    const { data: pl } = await client
      .from('playlists')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    const { data: existing } = await client
      .from('playlist_items')
      .select('id')
      .eq('playlist_id', id)
      .eq('content_id', videoId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ success: true, alreadyIn: true, message: 'Video is already in this playlist.' });
    }

    const { data: video } = await client
      .from('videos')
      .select('id, video_type')
      .eq('id', videoId)
      .maybeSingle();

    const [{ count }, { data: maxPosRow }] = await Promise.all([
      client
        .from('playlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', id),
      client
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const nextPos = Math.max(1, Number(maxPosRow?.position || 0) + 1);
    const { data: entry, error } = await client
      .from('playlist_items')
      .insert({
        playlist_id: id,
        content_type: video?.video_type === 'short' ? 'short' : 'video',
        content_id: videoId,
        position: nextPos,
        added_by_user_id: user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    await client
      .from('playlists')
      .update({ items_count: (count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, message: 'Video added to playlist', entry });
  } catch (err: any) {
    console.error('addVideoToPlaylist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to add video to playlist' });
  }
};

export const removeVideoFromPlaylist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id, videoId } = req.params;

  try {
    const client = db();
    const { data: pl } = await client
      .from('playlists')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    await client
      .from('playlist_items')
      .delete()
      .eq('playlist_id', id)
      .eq('content_id', videoId);

    const { count } = await client
      .from('playlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', id);

    await client
      .from('playlists')
      .update({ items_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, message: 'Video removed from playlist.' });
  } catch (err: any) {
    console.error('removeVideoFromPlaylist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to remove video from playlist' });
  }
};

export const reorderVideos = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { videoIds } = req.body || {};

  if (!Array.isArray(videoIds)) {
    return res.status(400).json({ error: 'videoIds must be an array of string IDs.' });
  }

  try {
    const client = db();
    const { data: pl } = await client
      .from('playlists')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!pl) {
      return res.status(404).json({ error: 'Playlist not found.' });
    }

    await Promise.all(
      videoIds.map((vid: string, index: number) =>
        client
          .from('playlist_items')
          .update({ position: index + 1 })
          .eq('playlist_id', id)
          .eq('content_id', vid)
      )
    );

    await client
      .from('playlists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, message: 'Playlist reordered successfully.' });
  } catch (err: any) {
    console.error('reorderVideos error:', err);
    return res.status(500).json({ error: err.message || 'Failed to reorder playlist' });
  }
};

export const getShareLink = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const client = db();
    const { data: pl, error } = await client
      .from('playlists')
      .select('id, title, visibility')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'paytune.com';
    const shareUrl = `${protocol}://${host}/playlist/${id}`;

    return res.json({
      playlistId: id,
      title: pl.title,
      shareUrl,
      isPublic: pl.visibility === 'public',
    });
  } catch (err: any) {
    console.error('getShareLink error:', err);
    return res.status(500).json({ error: err.message || 'Failed to build share link' });
  }
};
