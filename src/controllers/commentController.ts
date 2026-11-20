import { Request, Response } from 'express';
import { supabaseAdmin, rawSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { notifyOnNewComment } from '../services/notificationService';

const db = () => rawSupabaseAdmin || supabaseAdmin;

interface ThreadedComment {
  id: string;
  video_id: string;
  user_id: string | null;
  parent_comment_id: string | null;
  comment_text: string;
  likes: number;
  is_liked: boolean;
  is_pinned: boolean;
  created_at: string;
  user_name: string;
  user_username: string;
  user_avatar: string;
  is_artist: boolean;
  replies?: ThreadedComment[];
}

/**
 * GET /api/comments/:videoId
 * Returns threaded comments backed by public.comments and public.profiles
 */
export const getComments = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const videoId = req.params.videoId || req.params.id;
  const user = (req as any).user;
  const userId = user?.id ? String(user.id) : null;
  const client = db();

  try {
    const { data: video } = await client
      .from('videos')
      .select('id, created_by_user_id')
      .eq('id', videoId)
      .maybeSingle();

    const creatorUserId = video?.created_by_user_id || null;

    const { data: rawComments, error } = await client
      .from('comments')
      .select('*')
      .eq('content_id', videoId)
      .in('moderation_status', ['approved', 'pending'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = Array.from(new Set((rawComments || []).map((c: any) => c.user_id).filter(Boolean)));
    const profileMap = new Map<string, any>();

    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('user_id, username, display_name, avatar_storage_path')
        .in('user_id', userIds);

      for (const p of profiles || []) {
        profileMap.set(p.user_id, p);
      }
    }

    const allFormatted: ThreadedComment[] = (rawComments || []).map((c: any) => {
      const profile = c.user_id ? profileMap.get(c.user_id) || {} : {};
      const meta = (c.metadata && typeof c.metadata === 'object' ? c.metadata : {}) as Record<string, any>;
      const likedBy: string[] = Array.isArray(meta.liked_by) ? meta.liked_by : [];
      const isArtistComment = Boolean(creatorUserId && c.user_id && c.user_id === creatorUserId);

      return {
        id: String(c.id),
        video_id: String(c.content_id),
        user_id: c.user_id ? String(c.user_id) : null,
        parent_comment_id: c.parent_comment_id ? String(c.parent_comment_id) : null,
        comment_text: c.comment_text || '',
        likes: Number(c.likes_count || 0),
        is_liked: Boolean(userId && likedBy.includes(userId)),
        is_pinned: Boolean(meta.is_pinned),
        created_at: c.created_at || new Date().toISOString(),
        user_name: profile.display_name || profile.username || 'PAYTUNE Listener',
        user_username: profile.username || 'user',
        user_avatar: profile.avatar_storage_path || '',
        is_artist: isArtistComment,
        replies: [],
      };
    });

    const commentMap = new Map<string, ThreadedComment>();
    allFormatted.forEach((c) => commentMap.set(c.id, c));

    const topLevel: ThreadedComment[] = [];
    allFormatted.forEach((c) => {
      if (!c.parent_comment_id) {
        topLevel.push(c);
      } else {
        const parent = commentMap.get(c.parent_comment_id);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          parent.replies.push(c);
          parent.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else {
          topLevel.push(c);
        }
      }
    });

    topLevel.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return res.json(topLevel);
  } catch (error: any) {
    console.error('getComments error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load comments' });
  }
};

/**
 * POST /api/comments/:videoId
 */
export const createComment = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const videoId = req.params.videoId || req.params.id;
  const user = (req as any).user;
  const { text, comment_text, parentCommentId, parent_comment_id } = req.body || {};

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required to comment.' });
  }

  const content = String(text || comment_text || '').trim();
  if (!content) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }

  const client = db();

  try {
    const { data: video, error: vErr } = await client
      .from('videos')
      .select('id, title, video_type, is_free, is_paywalled, created_by_user_id, artist_profile_id, creator_channel_id')
      .eq('id', videoId)
      .maybeSingle();

    if (vErr || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!video.is_free || video.is_paywalled) {
      const isCreator = video.created_by_user_id === user.id;
      const { data: grant } = await client
        .from('premium_content_access_grants')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', videoId)
        .is('revoked_at', null)
        .maybeSingle();

      if (!grant && !isCreator) {
        return res.status(403).json({
          error: 'You must purchase this video to join the discussion.',
          requiresPurchase: true,
        });
      }
    }

    const targetParentId = parentCommentId || parent_comment_id || null;
    const nowIso = new Date().toISOString();
    const contentType = video.video_type === 'short' ? 'short' : 'video';

    const { data: comment, error } = await client
      .from('comments')
      .insert({
        content_type: contentType,
        content_id: videoId,
        user_id: user.id,
        parent_comment_id: targetParentId,
        comment_text: content,
        moderation_status: 'approved',
        likes_count: 0,
        replies_count: 0,
        metadata: { is_pinned: false, liked_by: [] },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (error) throw error;

    const { data: profile } = await client
      .from('profiles')
      .select('user_id, username, display_name, avatar_storage_path')
      .eq('user_id', user.id)
      .maybeSingle();

    const formatted: ThreadedComment = {
      id: String(comment.id),
      video_id: String(comment.content_id),
      user_id: String(comment.user_id),
      parent_comment_id: targetParentId ? String(targetParentId) : null,
      comment_text: content,
      likes: 0,
      is_liked: false,
      is_pinned: false,
      created_at: comment.created_at,
      user_name: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'PAYTUNE Listener',
      user_username: profile?.username || 'user',
      user_avatar: profile?.avatar_storage_path || '',
      is_artist: video.created_by_user_id === user.id,
      replies: [],
    };

    try {
      await notifyOnNewComment({
        commentId: String(comment.id),
        videoId,
        videoTitle: video.title || 'Music Video',
        artistId: video.artist_profile_id || video.creator_channel_id,
        authorUser: { id: user.id, name: formatted.user_name },
        commentText: content,
        parentId: targetParentId,
      });
    } catch (notifErr) {
      console.warn('Notification error for comment:', notifErr);
    }

    return res.status(201).json(formatted);
  } catch (error: any) {
    console.error('createComment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to post comment' });
  }
};

/**
 * PUT or POST /api/comments/:commentId/like
 */
export const toggleCommentLike = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required to like comments' });
  }

  const client = db();

  try {
    const { data: comment, error: cErr } = await client
      .from('comments')
      .select('id, likes_count, metadata')
      .eq('id', targetId)
      .maybeSingle();

    if (cErr || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const meta = (comment.metadata && typeof comment.metadata === 'object' ? comment.metadata : {}) as Record<string, any>;
    const likedBy: string[] = Array.isArray(meta.liked_by) ? [...meta.liked_by] : [];
    const uid = String(user.id);
    const alreadyLiked = likedBy.includes(uid);

    const nextLikedBy = alreadyLiked ? likedBy.filter((x) => x !== uid) : [...likedBy, uid];
    const nextLikes = nextLikedBy.length;

    const { error: updErr } = await client
      .from('comments')
      .update({
        likes_count: nextLikes,
        metadata: { ...meta, liked_by: nextLikedBy },
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (updErr) throw updErr;

    return res.json({ liked: !alreadyLiked, likes: nextLikes });
  } catch (error: any) {
    console.error('toggleCommentLike error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle like on comment' });
  }
};

/**
 * DELETE /api/comments/:commentId
 */
export const deleteComment = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = db();

  try {
    const { data: comment, error } = await client
      .from('comments')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (error || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const { data: video } = await client
      .from('videos')
      .select('created_by_user_id')
      .eq('id', comment.content_id)
      .maybeSingle();

    const isOwner = comment.user_id === user.id;
    const isMaster = ['master', 'master_admin', 'admin'].includes(String(user.role || ''));
    const isCreator = Boolean(video && video.created_by_user_id === user.id);

    if (!isOwner && !isMaster && !isCreator) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment.' });
    }

    await client.from('comments').delete().eq('parent_comment_id', targetId);
    const { error: delErr } = await client.from('comments').delete().eq('id', targetId);
    if (delErr) throw delErr;

    return res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (error: any) {
    console.error('deleteComment error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/comments/:commentId/pin
 */
export const pinComment = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = db();

  try {
    const { data: comment } = await client
      .from('comments')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const { data: video } = await client
      .from('videos')
      .select('created_by_user_id')
      .eq('id', comment.content_id)
      .maybeSingle();

    const isMaster = ['master', 'master_admin', 'admin'].includes(String(user.role || ''));
    if (!isMaster && video?.created_by_user_id !== user.id) {
      return res.status(403).json({ error: 'Only the video creator can pin comments.' });
    }

    const currentMeta = (comment.metadata && typeof comment.metadata === 'object' ? comment.metadata : {}) as Record<string, any>;
    const newPin = !Boolean(currentMeta.is_pinned);

    if (newPin) {
      const { data: siblingComments } = await client
        .from('comments')
        .select('id, metadata')
        .eq('content_id', comment.content_id);

      for (const s of siblingComments || []) {
        const sMeta = (s.metadata && typeof s.metadata === 'object' ? s.metadata : {}) as Record<string, any>;
        if (sMeta.is_pinned) {
          await client
            .from('comments')
            .update({ metadata: { ...sMeta, is_pinned: false }, updated_at: new Date().toISOString() })
            .eq('id', s.id);
        }
      }
    }

    await client
      .from('comments')
      .update({
        metadata: { ...currentMeta, is_pinned: newPin },
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    return res.json({ success: true, is_pinned: newPin });
  } catch (error: any) {
    console.error('pinComment error:', error);
    return res.status(500).json({ error: error.message });
  }
};
