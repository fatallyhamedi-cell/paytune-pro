import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { notifyOnNewComment } from '../services/notificationService';

interface ThreadedComment {
  id: string;
  video_id: string;
  user_id: string;
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
 * Returns all comments with nested replies (up to 3 levels), user names, user avatars, likes count, isLiked.
 */
export const getComments = async (req: Request, res: Response) => {
  const videoId = req.params.videoId || req.params.id;
  const user = (req as any).user;
  const userId = user?.id;

  try {
    // 1. Fetch video to determine artist ID
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('artist_id')
      .eq('id', videoId)
      .maybeSingle();

    const artistId = video?.artist_id;

    // 2. Fetch all comments for this video
    const { data: rawComments, error } = await supabaseAdmin
      .from('user_comments')
      .select('*, profiles(id, full_name, username, profile_image)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 3. Fetch user's comment likes
    let userCommentLikes = new Set<string>();
    if (userId) {
      const { data: likes } = await supabaseAdmin
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', userId);
      (likes || []).forEach((l: any) => userCommentLikes.add(String(l.comment_id)));
    }

    // 4. Format comments
    const allFormatted: ThreadedComment[] = (rawComments || []).map((c: any) => {
      const profile = c.profiles || {};
      const fullName = profile.full_name || "PAYTUNE Fan";
      const isArtistComment = artistId && (c.user_id === artistId || profile.id === artistId);

      return {
        id: String(c.id),
        video_id: String(c.video_id),
        user_id: String(c.user_id),
        parent_comment_id: c.parent_comment_id ? String(c.parent_comment_id) : null,
        comment_text: c.comment_text || c.text || "",
        likes: Number(c.likes || 0),
        is_liked: userCommentLikes.has(String(c.id)),
        is_pinned: !!c.is_pinned,
        created_at: c.created_at || new Date().toISOString(),
        user_name: fullName,
        user_username: profile.username || "user",
        user_avatar: profile.profile_image || profile.avatar_url || "",
        is_artist: isArtistComment,
        replies: []
      };
    });

    // 5. Build 3-level tree structure
    const commentMap = new Map<string, ThreadedComment>();
    allFormatted.forEach(c => commentMap.set(c.id, c));

    const topLevel: ThreadedComment[] = [];

    allFormatted.forEach(c => {
      if (!c.parent_comment_id) {
        topLevel.push(c);
      } else {
        const parent = commentMap.get(c.parent_comment_id);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          parent.replies.push(c);
          // Sort replies chronologically
          parent.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else {
          // If parent is deleted or not found, show at top level
          topLevel.push(c);
        }
      }
    });

    // Sort top level: pinned comment first, then newest or highest likes
    topLevel.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json(topLevel);
  } catch (error: any) {
    console.warn("getComments fallback to empty list:", error?.message || error);
    res.json([]);
  }
};

/**
 * POST /api/comments/:videoId
 * Body: { text, parentCommentId? }. Requires authentication.
 * Requires user to have purchased the video (if paid video).
 */
export const createComment = async (req: Request, res: Response) => {
  const videoId = req.params.videoId || req.params.id;
  const user = (req as any).user;
  const { text, comment_text, parentCommentId, parent_comment_id } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Authentication required to comment." });
  }

  const content = (text || comment_text || "").trim();
  if (!content) {
    return res.status(400).json({ error: "Comment text cannot be empty." });
  }

  try {
    // 1. Check if video is free or if user purchased
    const { data: video, error: vErr } = await supabaseAdmin
      .from('videos')
      .select('id, is_free, price_rwf, artist_id')
      .eq('id', videoId)
      .single();

    if (vErr || !video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const isFree = video.is_free || !video.price_rwf;
    if (!isFree) {
      const { data: purchase } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();

      const { data: artistRecord } = await supabaseAdmin
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const isArtist = artistRecord && artistRecord.id === video.artist_id;

      if (!purchase && !isArtist) {
        return res.status(403).json({ 
          error: "You must purchase this video to join the discussion.",
          requiresPurchase: true 
        });
      }
    }

    const targetParentId = parentCommentId || parent_comment_id || null;

    // 2. Insert comment
    const { data: comment, error } = await supabaseAdmin
      .from('user_comments')
      .insert({
        video_id: videoId,
        user_id: user.id,
        comment_text: content,
        parent_comment_id: targetParentId,
        likes: 0,
        is_pinned: false,
        created_at: new Date().toISOString()
      })
      .select('*, profiles(id, full_name, username, profile_image)')
      .single();

    if (error) throw error;

    const profile = comment.profiles || user.user_metadata || {};
    const formatted: ThreadedComment = {
      id: String(comment.id),
      video_id: String(comment.video_id),
      user_id: String(comment.user_id),
      parent_comment_id: targetParentId ? String(targetParentId) : null,
      comment_text: content,
      likes: 0,
      is_liked: false,
      is_pinned: false,
      created_at: comment.created_at,
      user_name: profile.full_name || user.email?.split('@')[0] || "PAYTUNE Fan",
      user_username: profile.username || "user",
      user_avatar: profile.profile_image || profile.avatar_url || "",
      is_artist: video.artist_id === user.id,
      replies: []
    };

    try {
      notifyOnNewComment({
        commentId: String(comment.id),
        videoId,
        videoTitle: (video as any).title || 'Music Video',
        artistId: video.artist_id,
        authorUser: { id: user.id, name: profile.full_name || user.email || 'A fan' },
        commentText: content,
        parentId: targetParentId
      });
    } catch (notifErr) {
      console.warn("Notification error for comment:", notifErr);
    }

    res.status(201).json(formatted);
  } catch (error: any) {
    console.error("createComment error:", error);
    res.status(500).json({ error: error.message || "Failed to post comment" });
  }
};

/**
 * PUT or POST /api/comments/:commentId/like
 * Toggle like on comment
 */
export const toggleCommentLike = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required to like comments" });
  }

  try {
    const { data: comment, error: cErr } = await supabaseAdmin
      .from('user_comments')
      .select('id, likes')
      .eq('id', targetId)
      .single();

    if (cErr || !comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const { data: existing } = await supabaseAdmin
      .from('comment_likes')
      .select('id')
      .eq('comment_id', targetId)
      .eq('user_id', user.id)
      .maybeSingle();

    let newLikes = Number(comment.likes || 0);

    if (existing) {
      await supabaseAdmin.from('comment_likes').delete().eq('id', existing.id);
      newLikes = Math.max(0, newLikes - 1);
      await supabaseAdmin.from('user_comments').update({ likes: newLikes }).eq('id', targetId);
      return res.json({ liked: false, likes: newLikes });
    } else {
      await supabaseAdmin.from('comment_likes').insert({ comment_id: targetId, user_id: user.id });
      newLikes = newLikes + 1;
      await supabaseAdmin.from('user_comments').update({ likes: newLikes }).eq('id', targetId);
      return res.json({ liked: true, likes: newLikes });
    }
  } catch (error: any) {
    console.error("toggleCommentLike error:", error);
    res.status(500).json({ error: error.message || "Failed to toggle like on comment" });
  }
};

/**
 * DELETE /api/comments/:commentId
 * Delete own comment
 */
export const deleteComment = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { data: comment, error } = await supabaseAdmin
      .from('user_comments')
      .select('*, videos(artist_id)')
      .eq('id', targetId)
      .single();

    if (error || !comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const isOwner = comment.user_id === user.id;
    const isMaster = user.role === 'master' || user.user_metadata?.role === 'master';
    
    let isArtist = false;
    if (comment.videos?.artist_id) {
      const { data: artistRec } = await supabaseAdmin
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (artistRec && artistRec.id === comment.videos.artist_id) {
        isArtist = true;
      }
    }

    if (!isOwner && !isMaster && !isArtist) {
      return res.status(403).json({ error: "Unauthorized to delete this comment." });
    }

    // Delete comment
    await supabaseAdmin.from('user_comments').delete().eq('id', targetId);
    // Also delete replies
    await supabaseAdmin.from('user_comments').delete().eq('parent_comment_id', targetId);

    res.json({ success: true, message: "Comment deleted successfully." });
  } catch (error: any) {
    console.error("deleteComment error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/comments/:commentId/pin
 * Artist can pin/unpin a comment to top
 */
export const pinComment = async (req: Request, res: Response) => {
  const { commentId, id } = req.params;
  const targetId = commentId || id;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { data: comment } = await supabaseAdmin
      .from('user_comments')
      .select('*, videos(artist_id)')
      .eq('id', targetId)
      .single();

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const currentPin = !!comment.is_pinned;
    const newPin = !currentPin;

    if (newPin) {
      // Unpin any other pinned comment on this video
      await supabaseAdmin
        .from('user_comments')
        .update({ is_pinned: false })
        .eq('video_id', comment.video_id);
    }

    await supabaseAdmin
      .from('user_comments')
      .update({ is_pinned: newPin })
      .eq('id', targetId);

    res.json({ success: true, is_pinned: newPin });
  } catch (error: any) {
    console.error("pinComment error:", error);
    res.status(500).json({ error: error.message });
  }
};
