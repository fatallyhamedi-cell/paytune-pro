import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

async function enrichShorts(videos: any[], currentUserId?: string) {
  if (!videos || videos.length === 0) return [];
  const client = db();

  const videoIds = videos.map((v) => v.id);
  const artistIds = Array.from(new Set(videos.map((v) => v.artist_profile_id).filter(Boolean)));
  const channelIds = Array.from(new Set(videos.map((v) => v.creator_channel_id).filter(Boolean)));

  const [
    { data: artists },
    { data: channels },
    { data: reactions },
    { data: comments },
    { data: analytics },
    { data: follows },
  ] = await Promise.all([
    artistIds.length > 0
      ? client.from('artist_profiles').select('id, artist_name, artist_handle, avatar_path, verification_status, approval_status').in('id', artistIds)
      : Promise.resolve({ data: [] as any[] }),
    channelIds.length > 0
      ? client.from('creator_channels').select('id, channel_name, channel_handle, avatar_path, verification_status, approval_status').in('id', channelIds)
      : Promise.resolve({ data: [] as any[] }),
    client.from('content_reactions').select('content_id, user_id').eq('reaction_type', 'like').in('content_id', videoIds),
    client.from('comments').select('content_id').in('content_id', videoIds),
    client.from('video_daily_analytics').select('video_id, valid_views, total_view_events').in('video_id', videoIds),
    currentUserId && artistIds.length > 0
      ? client.from('artist_follows').select('artist_id').eq('user_id', currentUserId).in('artist_id', artistIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const artistMap = new Map((artists || []).map((a: any) => [a.id, a]));
  const channelMap = new Map((channels || []).map((c: any) => [c.id, c]));
  const followedSet = new Set((follows || []).map((f: any) => f.artist_id));

  const likesCountMap: Record<string, number> = {};
  const userLikedSet = new Set<string>();
  (reactions || []).forEach((r: any) => {
    likesCountMap[r.content_id] = (likesCountMap[r.content_id] || 0) + 1;
    if (currentUserId && r.user_id === currentUserId) {
      userLikedSet.add(r.content_id);
    }
  });

  const commentsCountMap: Record<string, number> = {};
  (comments || []).forEach((c: any) => {
    commentsCountMap[c.content_id] = (commentsCountMap[c.content_id] || 0) + 1;
  });

  const viewsMap: Record<string, number> = {};
  (analytics || []).forEach((a: any) => {
    viewsMap[a.video_id] = (viewsMap[a.video_id] || 0) + Number(a.valid_views || a.total_view_events || 0);
  });

  return videos.map((v: any) => {
    const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
    const artist: any = artistMap.get(v.artist_profile_id) || {};
    const channel: any = channelMap.get(v.creator_channel_id) || {};
    const artistName = artist.artist_name || channel.channel_name || meta.artist_name || 'Creator';
    const handle = artist.artist_handle || channel.channel_handle || '';

    return {
      id: String(v.id),
      title: v.title || '',
      description: v.description || '',
      artist_id: String(v.artist_profile_id || v.creator_channel_id || ''),
      artist_name: artistName,
      artist_username: handle ? `@${String(handle).replace(/^@/, '')}` : '',
      artist_avatar: artist.avatar_path || channel.avatar_path || '',
      artist_verified:
        artist.verification_status === 'verified' ||
        channel.verification_status === 'verified' ||
        artist.approval_status === 'approved',
      subscribers_count: Number(meta.subscribers_count || 0),
      thumbnail_url: meta.thumbnail_url || '',
      video_url: meta.video_url || '',
      vertical_url: meta.video_url || '',
      duration: Number(v.duration_seconds || 0),
      views: viewsMap[v.id] || Number(meta.view_count ?? meta.views ?? 0),
      likes: likesCountMap[v.id] || 0,
      comments_count: commentsCountMap[v.id] || 0,
      shares_count: Number(meta.shares_count || 0),
      created_at: v.published_at || v.created_at,
      uploaded_at: v.published_at || v.created_at,
      song_title: meta.song_title || v.title || '',
      is_short: true,
      is_free: true,
      is_liked: userLikedSet.has(v.id),
      is_subscribed: followedSet.has(v.artist_profile_id),
      category: 'Shorts',
    };
  });
}

/**
 * GET /api/shorts/feed
 */
export const getShortsFeed = async (req: Request, res: Response) => {
  const { limit = '20', offset = '0', sort = 'trending' } = req.query;
  const numLimit = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
  const numOffset = Math.max(0, parseInt(String(offset), 10) || 0);
  const currentUserId = (req as any).user?.id;

  try {
    const client = db();
    const { data, error } = await client
      .from('videos')
      .select('*')
      .eq('video_type', 'short')
      .eq('visibility', 'public')
      .eq('publication_status', 'published')
      .neq('moderation_status', 'rejected')
      .neq('moderation_status', 'restricted')
      .order('published_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const nowMs = Date.now();
    const eligibleRows = (data || []).filter(
      (v: any) => !v.scheduled_at || new Date(v.scheduled_at).getTime() <= nowMs
    );

    const items = await enrichShorts(eligibleRows, currentUserId);

    if (sort === 'following' && currentUserId) {
      items.sort((a, b) => (b.is_subscribed ? 1 : 0) - (a.is_subscribed ? 1 : 0));
    } else if (sort !== 'new') {
      items.sort((a, b) => (b.views + b.likes * 3) - (a.views + a.likes * 3));
    }

    const total = items.length;
    const paged = items.slice(numOffset, numOffset + numLimit);
    const hasMore = numOffset + paged.length < total;

    return res.json({
      items: paged,
      shorts: paged,
      total,
      nextOffset: hasMore ? numOffset + numLimit : null,
      hasMore,
    });
  } catch (error: any) {
    console.error('getShortsFeed error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load shorts feed' });
  }
};

/**
 * GET /api/shorts/:id
 */
export const getShortById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const currentUserId = user?.id;

  try {
    const client = db();
    const { data: video, error } = await client
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!video) {
      return res.status(404).json({ error: 'Short video not found' });
    }

    const isMaster = user?.role === 'MASTER_ADMIN' || user?.role === 'master' || user?.role === 'admin';
    let isOwner = Boolean(isMaster);
    if (currentUserId && !isOwner) {
      if (video.created_by_user_id && String(video.created_by_user_id) === String(currentUserId)) {
        isOwner = true;
      } else if (video.artist_profile_id) {
        const { data: ap } = await client
          .from('artist_profiles')
          .select('id')
          .eq('id', video.artist_profile_id)
          .or(`created_by_user_id.eq.${currentUserId},primary_contact_user_id.eq.${currentUserId}`)
          .maybeSingle();
        if (ap) isOwner = true;
      }
    }

    const isFuture = Boolean(video.scheduled_at && new Date(video.scheduled_at).getTime() > Date.now());
    const blocked = video.moderation_status === 'rejected' || video.moderation_status === 'restricted';
    const unpublished = video.publication_status && video.publication_status !== 'published';
    const isPrivate = video.visibility === 'private';

    if (!isOwner && (blocked || unpublished || isFuture || isPrivate)) {
      return res.status(404).json({ error: 'Short video not found' });
    }

    const [normalized] = await enrichShorts([video], currentUserId);
    let captions: any[] = [];
    try {
      const { data: captionRows } = await client
        .from('video_captions')
        .select('id, language_code, track_label, track_type, is_default, media_asset_id')
        .eq('video_id', id)
        .eq('is_active', true);

      if (captionRows && captionRows.length > 0) {
        const ids = captionRows.map((c: any) => c.media_asset_id).filter(Boolean);
        const { data: assets } = ids.length > 0
          ? await client.from('media_assets').select('id, storage_bucket, storage_path, metadata').in('id', ids)
          : { data: [] as any[] };
        const map = new Map<string, any>((assets || []).map((a: any) => [String(a.id), a]));
        captions = captionRows
          .map((c: any) => {
            const asset = map.get(String(c.media_asset_id));
            let url = asset?.metadata?.public_url || '';
            if (!url && asset?.storage_bucket && asset?.storage_path) {
              url = client.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data?.publicUrl || '';
            }
            return {
              id: String(c.id),
              language_code: c.language_code || 'en',
              label: c.track_label || 'English',
              kind: c.track_type || 'subtitles',
              is_default: Boolean(c.is_default),
              url,
            };
          })
          .filter((c) => Boolean(c.url));
      }
    } catch {}

    return res.json({ ...normalized, captions });
  } catch (error: any) {
    console.error('getShortById error:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve short' });
  }
};

/**
 * POST /api/shorts/:id/like
 */
export const toggleShortLike = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to like a short.' });
  }

  try {
    const client = db();
    const { data: existing } = await client
      .from('content_reactions')
      .select('id')
      .eq('content_type', 'short')
      .eq('content_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', 'like')
      .maybeSingle();

    if (existing) {
      await client.from('content_reactions').delete().eq('id', existing.id);
    } else {
      await client.from('content_reactions').insert({
        content_type: 'short',
        content_id: id,
        user_id: user.id,
        reaction_type: 'like',
      });
    }

    const { count } = await client
      .from('content_reactions')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', 'short')
      .eq('content_id', id)
      .eq('reaction_type', 'like');

    return res.json({
      success: true,
      liked: !existing,
      likes: count || 0,
    });
  } catch (error: any) {
    console.error('toggleShortLike error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle like' });
  }
};

/**
 * POST /api/shorts/:id/view
 */
export const recordShortView = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { watched_seconds = 0, completed = false, device_type = 'web', country = null } = req.body || {};
  const user = (req as any).user;

  try {
    const client = db();
    const { data: video } = await client.from('videos').select('id, metadata').eq('id', id).maybeSingle();
    if (!video) {
      return res.status(404).json({ error: 'Short not found' });
    }

    await client.from('video_view_events').insert({
      video_id: id,
      viewer_user_id: user?.id || null,
      watch_duration_seconds: Number(watched_seconds) || 0,
      validation_status: 'valid',
      traffic_source: 'shorts_feed',
      metadata: {
        completed: Boolean(completed),
        device_type: String(device_type).slice(0, 50),
        country: country ? String(country).slice(0, 8) : null,
      },
    });

    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
    const newViews = Number(meta.view_count ?? meta.views ?? 0) + 1;
    await client
      .from('videos')
      .update({ metadata: { ...meta, view_count: newViews, views: newViews }, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, views: newViews });
  } catch (error: any) {
    console.error('recordShortView error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record view' });
  }
};

/**
 * POST /api/shorts/:id/subscribe
 */
export const toggleShortSubscribe = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to follow creators.' });
  }

  try {
    const client = db();
    const { data: video } = await client
      .from('videos')
      .select('artist_profile_id')
      .eq('id', id)
      .maybeSingle();

    if (!video?.artist_profile_id) {
      return res.status(404).json({ error: 'Creator profile not found for this short.' });
    }

    const artistId = video.artist_profile_id;
    const { data: existing } = await client
      .from('artist_follows')
      .select('id')
      .eq('artist_id', artistId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await client.from('artist_follows').delete().eq('id', existing.id);
    } else {
      await client.from('artist_follows').insert({ artist_id: artistId, user_id: user.id });
    }

    const { count } = await client
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId);

    return res.json({
      success: true,
      subscribed: !existing,
      followed: !existing,
      subscribers_count: count || 0,
      followers_count: count || 0,
      artist_id: artistId,
    });
  } catch (error: any) {
    console.error('toggleShortSubscribe error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle follow' });
  }
};

export const toggleShortFollow = toggleShortSubscribe;

/**
 * GET /api/shorts/:id/comments
 */
export const getShortComments = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const client = db();
    const { data: comments, error } = await client
      .from('comments')
      .select('id, content_id, user_id, comment_text, likes_count, created_at')
      .eq('content_id', id)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = Array.from(new Set((comments || []).map((c: any) => c.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length > 0
      ? await client.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', userIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    return res.json(
      (comments || []).map((c: any) => {
        const p: any = profileMap.get(c.user_id) || {};
        return {
          id: c.id,
          video_id: c.content_id,
          user_id: c.user_id,
          user_name: p.display_name || p.username || 'Listener',
          user_avatar: p.avatar_storage_path || '',
          content: c.comment_text,
          created_at: c.created_at,
          likes: Number(c.likes_count || 0),
        };
      })
    );
  } catch (error: any) {
    console.error('getShortComments error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load comments' });
  }
};

/**
 * POST /api/shorts/:id/comments
 */
export const postShortComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body || {};
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required to comment.' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  try {
    const client = db();
    const { data: inserted, error } = await client
      .from('comments')
      .insert({
        content_type: 'short',
        content_id: id,
        user_id: user.id,
        comment_text: String(content).trim(),
        moderation_status: 'approved',
      })
      .select('*')
      .single();

    if (error) throw error;

    const { data: profile } = await client
      .from('profiles')
      .select('display_name, username, avatar_storage_path')
      .eq('user_id', user.id)
      .maybeSingle();

    return res.status(201).json({
      success: true,
      comment: {
        id: inserted.id,
        video_id: inserted.content_id,
        user_id: inserted.user_id,
        user_name: profile?.display_name || profile?.username || user.user_metadata?.full_name || 'User',
        user_avatar: profile?.avatar_storage_path || '',
        content: inserted.comment_text,
        created_at: inserted.created_at,
        likes: 0,
      },
    });
  } catch (error: any) {
    console.error('postShortComment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to post comment' });
  }
};
