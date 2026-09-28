import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export interface VideoArtist {
  id: string;
  full_name: string;
  profile_image?: string;
  is_verified?: boolean;
  subscribers_count?: number;
}

export interface VideoData {
  id: string;
  title: string;
  description: string;
  artist_id: string;
  artist_name: string;
  price_rwf: number;
  price_usd: number;
  is_free: boolean;
  video_url: string;
  preview_url: string;
  thumbnail_url: string;
  duration: number;
  views: number;
  likes: number;
  rating_avg: number;
  rating_count: number;
  uploaded_at: string;
  upload_date?: string;
  category: string;
  visibility: string;
  tags: string[];
  userOwns: boolean;
  purchaseCount?: number;
  userLiked?: boolean;
  userSubscribed?: boolean;
  userRating?: number;
  artists?: VideoArtist;
  minTier?: any;
}

export interface VideoComment {
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
  replies?: VideoComment[];
}

export function useVideo(videoId: string | undefined) {
  const { user } = useAuth();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relatedVideos, setRelatedVideos] = useState<VideoData[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const [savedProgress, setSavedProgress] = useState<number>(0);

  // Resilient get with retry on 429
  const resilientGet = async (url: string) => {
    try {
      return await api.get(url);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        await new Promise((r) => setTimeout(r, 600));
        return await api.get(url);
      }
      throw err;
    }
  };

  // Fetch single video
  const fetchVideo = useCallback(async () => {
    if (!videoId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await resilientGet(`/api/videos/${videoId}`);
      setVideo(res.data);
    } catch (err: any) {
      console.warn("Notice: video details query returned:", err?.response?.status || err?.message);
      setError(err.response?.data?.message || err.message || "Failed to load video");
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  // Fetch related videos
  const fetchRelated = useCallback(async () => {
    if (!videoId) return;
    try {
      setLoadingRelated(true);
      const res = await resilientGet(`/api/videos/${videoId}/related`);
      setRelatedVideos(res.data || []);
    } catch (err) {
      setRelatedVideos([]);
    } finally {
      setLoadingRelated(false);
    }
  }, [videoId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!videoId) return;
    try {
      setLoadingComments(true);
      const res = await resilientGet(`/api/comments/${videoId}`);
      setComments(res.data || []);
    } catch (err) {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [videoId]);

  // Fetch saved progress
  const fetchProgress = useCallback(async () => {
    if (!videoId || !user) return;
    try {
      const res = await api.get(`/api/videos/${videoId}/progress`);
      if (res.data?.positionSeconds) {
        setSavedProgress(res.data.positionSeconds);
      }
    } catch (err) {
      console.debug("Failed to load saved progress:", err);
    }
  }, [videoId, user]);

  useEffect(() => {
    fetchVideo();
    fetchRelated();
    fetchComments();
    fetchProgress();
  }, [fetchVideo, fetchRelated, fetchComments, fetchProgress]);

  // Actions
  const toggleLike = async () => {
    if (!videoId) return;
    const res = await api.post(`/api/videos/${videoId}/like`);
    setVideo(prev => prev ? {
      ...prev,
      likes: res.data.likes,
      userLiked: res.data.liked
    } : null);
    return res.data;
  };

  const toggleSubscribe = async () => {
    if (!videoId) return;
    const res = await api.post(`/api/videos/${videoId}/subscribe`);
    setVideo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        userSubscribed: res.data.subscribed,
        artists: prev.artists ? {
          ...prev.artists,
          subscribers_count: res.data.subscribers_count
        } : undefined
      };
    });
    return res.data;
  };

  const recordView = async () => {
    if (!videoId) return;
    try {
      const res = await api.post(`/api/videos/${videoId}/view`);
      if (res.data?.views) {
        setVideo(prev => prev ? { ...prev, views: res.data.views } : null);
      }
    } catch (e) {
      console.debug("Record view skipped/restricted:", e);
    }
  };

  const saveProgress = async (seconds: number) => {
    if (!videoId) return;
    try {
      await api.post(`/api/videos/${videoId}/progress`, { positionSeconds: seconds });
    } catch (e) {
      console.debug("Save progress failed:", e);
    }
  };

  const postComment = async (text: string, parentCommentId?: string) => {
    if (!videoId) return;
    const res = await api.post(`/api/comments/${videoId}`, {
      text,
      parentCommentId
    });
    // Refresh comments to reflect threading correctly
    await fetchComments();
    return res.data;
  };

  const toggleCommentLike = async (commentId: string) => {
    const res = await api.put(`/api/comments/${commentId}/like`);
    // Optimistic or recursive update
    setComments(prev => updateCommentInTree(prev, commentId, c => ({
      ...c,
      likes: res.data.likes,
      is_liked: res.data.liked
    })));
    return res.data;
  };

  const deleteComment = async (commentId: string) => {
    await api.delete(`/api/comments/${commentId}`);
    setComments(prev => removeCommentFromTree(prev, commentId));
  };

  const pinComment = async (commentId: string) => {
    const res = await api.put(`/api/comments/${commentId}/pin`);
    setComments(prev => updateCommentInTree(prev, commentId, c => ({
      ...c,
      is_pinned: res.data.is_pinned
    })));
  };

  return {
    video,
    loading,
    error,
    relatedVideos,
    loadingRelated,
    comments,
    loadingComments,
    savedProgress,
    refetchVideo: fetchVideo,
    refetchComments: fetchComments,
    toggleLike,
    toggleSubscribe,
    recordView,
    saveProgress,
    postComment,
    toggleCommentLike,
    deleteComment,
    pinComment,
    setVideo
  };
}

// Helpers for threaded comments
function updateCommentInTree(
  list: VideoComment[], 
  id: string, 
  updater: (c: VideoComment) => VideoComment
): VideoComment[] {
  return list.map(item => {
    if (item.id === id) {
      return updater(item);
    }
    if (item.replies && item.replies.length > 0) {
      return {
        ...item,
        replies: updateCommentInTree(item.replies, id, updater)
      };
    }
    return item;
  });
}

function removeCommentFromTree(list: VideoComment[], id: string): VideoComment[] {
  return list
    .filter(item => item.id !== id)
    .map(item => {
      if (item.replies && item.replies.length > 0) {
        return {
          ...item,
          replies: removeCommentFromTree(item.replies, id)
        };
      }
      return item;
    });
}
