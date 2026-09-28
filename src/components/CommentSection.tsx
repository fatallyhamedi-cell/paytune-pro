import React, { useState } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  Pin, 
  Trash2, 
  CornerDownRight, 
  Send, 
  Lock, 
  Sparkles,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoComment } from '../hooks/useVideo';
import { useAuth } from '../hooks/useAuth';

interface CommentSectionProps {
  videoId: string;
  comments: VideoComment[];
  userOwns: boolean;
  isFree: boolean;
  priceRwf: number;
  loadingComments: boolean;
  onPostComment: (text: string, parentCommentId?: string) => Promise<any>;
  onToggleCommentLike: (commentId: string) => Promise<any>;
  onDeleteComment: (commentId: string) => Promise<any>;
  onPinComment: (commentId: string) => Promise<any>;
  onBuyNow: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  videoId,
  comments,
  userOwns,
  isFree,
  priceRwf,
  loadingComments,
  onPostComment,
  onToggleCommentLike,
  onDeleteComment,
  onPinComment,
  onBuyNow
}) => {
  const { user, roleData } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('top');

  const canComment = isFree || userOwns;

  const countTotalComments = (list: VideoComment[]): number => {
    let count = list.length;
    for (const c of list) {
      if (c.replies && c.replies.length > 0) {
        count += countTotalComments(c.replies);
      }
    }
    return count;
  };

  const totalComments = countTotalComments(comments);

  // Sorting
  const sortedTopLevel = [...comments].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    if (sortBy === 'top') {
      return (b.likes || 0) - (a.likes || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleTopLevelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please login to post a comment.");
      return;
    }
    if (!canComment) {
      onBuyNow();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      await onPostComment(commentText.trim());
      setCommentText('');
    } catch (err: any) {
      console.error("Comment post error:", err);
      alert(err.response?.data?.error || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (!user) {
      alert("Please login to reply.");
      return;
    }
    if (!canComment) {
      onBuyNow();
      return;
    }
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      await onPostComment(replyText.trim(), parentId);
      setReplyText('');
      setReplyingTo(null);
    } catch (err: any) {
      console.error("Reply error:", err);
      alert(err.response?.data?.error || "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = Date.now();
      const diff = Math.max(0, now - new Date(dateStr).getTime());
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return "Recently";
    }
  };

  // Render individual comment with recursion for up to 3 levels
  const renderComment = (item: VideoComment, depth: number = 1) => {
    const isOwner = user?.id === item.user_id;
    const isMaster = roleData?.is_master || roleData?.role === 'MASTER_ADMIN';
    const canDelete = isOwner || isMaster || item.is_artist;

    return (
      <div 
        key={item.id} 
        id={`comment-${item.id}`}
        className={`relative ${depth > 1 ? 'ml-6 sm:ml-10 mt-3 pl-3 border-l-2 border-gray-200 dark:border-gray-800' : 'mt-5'}`}
      >
        <div className="flex items-start gap-3 group">
          {/* Avatar */}
          {item.user_avatar ? (
            <img
              src={item.user_avatar}
              alt={item.user_name}
              className="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-700 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-neutral-800 text-amber-500 font-bold flex items-center justify-center text-xs border border-gray-700 flex-shrink-0">
              {(item.user_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          {/* Comment Details */}
          <div className="flex-1 min-w-0">
            {/* Header: User name, badges, time */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {item.user_name}
              </span>

              {item.is_artist && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">
                  Artist
                </span>
              )}

              {item.is_pinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  <Pin className="w-2.5 h-2.5" /> Pinned
                </span>
              )}

              <span className="text-gray-400 dark:text-gray-500 font-normal">
                {formatRelativeTime(item.created_at)}
              </span>
            </div>

            {/* Comment Body */}
            <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 leading-relaxed break-words whitespace-pre-line">
              {item.comment_text}
            </p>

            {/* Actions: Like, Reply, Pin, Delete */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {/* Like */}
              <button
                onClick={() => onToggleCommentLike(item.id)}
                className={`flex items-center gap-1 hover:text-amber-500 transition-colors cursor-pointer ${
                  item.is_liked ? 'text-amber-500 font-bold' : ''
                }`}
                title="Like comment"
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${item.is_liked ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{item.likes > 0 ? item.likes : ''}</span>
              </button>

              {/* Reply (allowed up to 3 levels) */}
              {depth < 3 && (
                <button
                  onClick={() => setReplyingTo(replyingTo === item.id ? null : item.id)}
                  className="hover:text-amber-500 font-medium transition-colors cursor-pointer"
                >
                  Reply
                </button>
              )}

              {/* Artist Pin */}
              {item.is_artist && depth === 1 && (
                <button
                  onClick={() => onPinComment(item.id)}
                  className="hover:text-amber-500 transition-colors cursor-pointer"
                  title="Toggle pin"
                >
                  <Pin className="w-3 h-3" />
                </button>
              )}

              {/* Delete */}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm("Delete this comment?")) {
                      onDeleteComment(item.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity cursor-pointer ml-auto"
                  title="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Inline Reply Form */}
            {replyingTo === item.id && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Replying to ${item.user_name}...`}
                  maxLength={500}
                  className="flex-1 h-9 px-3 rounded-xl bg-gray-100 dark:bg-[#202020] border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <Button
                  onClick={() => handleReplySubmit(item.id)}
                  disabled={submitting || !replyText.trim()}
                  className="h-9 px-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
                <Button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  variant="ghost"
                  className="h-9 px-2 text-xs text-gray-400 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Render child replies */}
        {item.replies && item.replies.length > 0 && (
          <div className="space-y-2">
            {item.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="video-comments-section" className="pt-6">
      {/* Header with Comment count and Sorting */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            {totalComments} Comments
          </h3>
        </div>

        {/* Sort Filter */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setSortBy('top')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              sortBy === 'top'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Top Comments
          </button>
          <button
            onClick={() => setSortBy('newest')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              sortBy === 'newest'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Newest First
          </button>
        </div>
      </div>

      {/* Comment Input Box or Purchase Gate Notice */}
      <div className="my-5">
        {canComment ? (
          <form onSubmit={handleTopLevelSubmit} className="space-y-2">
            <div className="flex items-start gap-3">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Your avatar"
                  className="w-9 h-9 rounded-full object-cover border border-amber-500/30 flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center text-sm border border-amber-500/30 flex-shrink-0">
                  {(user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={user ? "Add a public comment..." : "Sign in to add a comment..."}
                  maxLength={500}
                  className="w-full p-3 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none transition-all"
                />
                <div className="flex items-center justify-between pt-1 text-xs text-gray-400">
                  <span>{500 - commentText.length} characters left</span>
                  <div className="flex items-center gap-2">
                    {commentText.trim() && (
                      <Button
                        type="button"
                        onClick={() => setCommentText('')}
                        variant="ghost"
                        className="h-8 px-3 text-xs text-gray-400 cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="submit"
                      id="submit-comment-btn"
                      disabled={submitting || !commentText.trim()}
                      className="h-8 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Comment</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Purchase required to join the conversation
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Only supporters who have unlocked this video for {priceRwf.toLocaleString()} RWF can post comments.
                </p>
              </div>
            </div>
            <Button
              onClick={onBuyNow}
              className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl cursor-pointer flex-shrink-0"
            >
              Unlock Access
            </Button>
          </div>
        )}
      </div>

      {/* Comment List */}
      {loadingComments ? (
        <div className="py-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-sm">Loading discussion...</span>
        </div>
      ) : sortedTopLevel.length === 0 ? (
        <div className="py-10 text-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">No comments yet.</p>
          <p className="text-xs mt-1">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTopLevel.map(c => renderComment(c, 1))}
        </div>
      )}
    </div>
  );
};
