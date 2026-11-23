import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

async function getOrCreateWishlistPlaylist(userId: string) {
  const client = db();
  const { data: existing, error: findErr } = await client
    .from('playlists')
    .select('*')
    .eq('owner_user_id', userId)
    .eq('playlist_type', 'system')
    .eq('title', 'Wishlist')
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await client
    .from('playlists')
    .insert({
      owner_user_id: userId,
      title: 'Wishlist',
      description: 'Saved Watch Later videos',
      playlist_type: 'system',
      visibility: 'private',
      is_system_playlist: true,
    })
    .select('*')
    .single();

  if (createErr) throw createErr;
  return created;
}

export const getWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = db();
    const { data: playlist } = await client
      .from('playlists')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('playlist_type', 'system')
      .eq('title', 'Wishlist')
      .maybeSingle();

    if (!playlist) {
      return res.json([]);
    }

    const { data: items, error: itemErr } = await client
      .from('playlist_items')
      .select('id, content_id, content_type, added_at, position')
      .eq('playlist_id', playlist.id)
      .order('added_at', { ascending: false });

    if (itemErr) throw itemErr;
    if (!items || items.length === 0) return res.json([]);

    const videoIds = items.map((i: any) => i.content_id).filter(Boolean);
    const { data: videos, error: vidErr } = await client
      .from('videos')
      .select('id, title, creator_channel_id, artist_profile_id, duration_seconds, visibility, is_free, metadata, created_at')
      .in('id', videoIds);

    if (vidErr) throw vidErr;

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

    const enriched = items
      .map((item: any) => {
        const video: any = videoMap.get(item.content_id);
        if (!video) return null;
        const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
        return {
          id: item.id,
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
          price_rwf: Number(meta.price_rwf || 0),
          price_usd: Number(meta.price_usd || 0),
          is_free: Boolean(video.is_free),
          duration: Number(video.duration_seconds || 0),
          category: meta.category || '',
          created_at: item.added_at,
        };
      })
      .filter(Boolean);

    return res.json(enriched);
  } catch (err: any) {
    console.error('getWishlist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load wishlist' });
  }
};

export const addToWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: 'videoId is required' });

  try {
    const client = db();
    const { data: video } = await client
      .from('videos')
      .select('id, video_type')
      .eq('id', videoId)
      .maybeSingle();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const playlist = await getOrCreateWishlistPlaylist(user.id);

    const { data: existing } = await client
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlist.id)
      .eq('content_id', videoId)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, alreadyIn: true, message: 'Already saved to Watch Later.' });
    }

    const [{ count }, { data: maxPosRow }] = await Promise.all([
      client
        .from('playlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id),
      client
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const nextPos = Math.max(1, Number(maxPosRow?.position || 0) + 1);
    const { data: inserted, error: insErr } = await client
      .from('playlist_items')
      .insert({
        playlist_id: playlist.id,
        content_type: video.video_type === 'short' ? 'short' : 'video',
        content_id: videoId,
        position: nextPos,
        added_by_user_id: user.id,
      })
      .select('*')
      .single();

    if (insErr) throw insErr;

    await client
      .from('playlists')
      .update({ items_count: (count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', playlist.id);

    return res.status(201).json({ success: true, message: 'Saved to Watch Later', entry: inserted });
  } catch (err: any) {
    console.error('addToWishlist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save to wishlist' });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { videoId } = req.params;

  try {
    const client = db();
    const { data: playlist } = await client
      .from('playlists')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('playlist_type', 'system')
      .eq('title', 'Wishlist')
      .maybeSingle();

    if (!playlist) {
      return res.json({ success: true, message: 'Removed from Watch Later.' });
    }

    const { error: delErr } = await client
      .from('playlist_items')
      .delete()
      .eq('playlist_id', playlist.id)
      .or(`content_id.eq.${videoId},id.eq.${videoId}`);

    if (delErr) throw delErr;

    const { count } = await client
      .from('playlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', playlist.id);

    await client
      .from('playlists')
      .update({ items_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', playlist.id);

    return res.json({ success: true, message: 'Removed from Watch Later.' });
  } catch (err: any) {
    console.error('removeFromWishlist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to remove from wishlist' });
  }
};
