import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Send, User as UserIcon, Loader2 } from 'lucide-react';
import { useRequireAuth } from '../hooks/useRequireAuth';

export interface CommentItem {
  id: string;
  video_id: string;
  user_id: string;
  text?: string;
  comment_text?: string;
  user_name?: string;
  user_avatar?: string;
  created_at: string;
  [key: string]: any;
}

export interface CommentSectionProps {
  videoId: string;
  comments?: CommentItem[];
  onPostComment?: (text: string) => Promise<any>;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  videoId,
  comments: propComments,
  onPostComment
}) => {
  const { requireAuth } = useRequireAuth();
  const [commentList, setCommentList] = useState<CommentItem[]>(propComments || []);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (propComments && propComments.length > 0) {
      setCommentList(propComments);
      return;
    }

    if (!videoId) return;

    setIsLoading(true);
    console.log('[CommentSection] Fetching comments for video:', videoId);
    axios
      .get(`/api/videos/${videoId}/comments`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        console.log('[CommentSection] Comments loaded:', data.length);
        setCommentList(data);
      })
      .catch((err) => {
        console.warn('[CommentSection] Error loading comments:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [videoId, propComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    const authed = requireAuth(undefined, 'Please sign in to post a comment.');
    if (!authed) return;

    setIsSubmitting(true);
    const commentText = inputText.trim();

    try {
      console.log(`[CommentSection] Posting comment for video ${videoId}: "${commentText}"`);

      let newComment: CommentItem;
      if (onPostComment) {
        newComment = await onPostComment(commentText);
      } else {
        const res = await axios.post(`/api/videos/${videoId}/comments`, {
          text: commentText,
          comment_text: commentText
        });
        newComment = res.data;
      }

      const fallbackItem: CommentItem = {
        id: newComment?.id || 'cmt-' + Date.now(),
        video_id: videoId,
        user_id: 'me',
        text: commentText,
        comment_text: commentText,
        user_name: 'You',
        user_avatar: '',
        created_at: new Date().toISOString()
      };

      setCommentList((prev) => [newComment || fallbackItem, ...prev]);
      setInputText('');
      console.log('[CommentSection] Comment posted successfully.');
    } catch (err: any) {
      console.error('[CommentSection] Failed to post comment:', err);
      alert(err.response?.data?.error || 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div id="comments-section" className="mt-8 space-y-6 pt-6 border-t border-gray-200 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-purple-600" />
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
          Comments ({commentList.length})
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 text-purple-600 overflow-hidden">
          <UserIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-2">
          <input
            id="comment-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
          />

          <div className="flex justify-end gap-2">
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              id="comment-submit-btn"
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-400 disabled:opacity-50 text-black font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Comment</span>
            </button>
          </div>
        </div>
      </form>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : commentList.length === 0 ? (
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-4 pt-2">
          {commentList.map((c) => {
            const author = c.user_name || 'Fan';
            const body = c.text || c.comment_text || '';
            const avatar = c.user_avatar || '';

            return (
              <div key={c.id} className="flex items-start gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 text-purple-600 overflow-hidden font-bold text-xs">
                  {avatar ? (
                    <img src={avatar} alt={author} className="w-full h-full object-cover" />
                  ) : (
                    author[0].toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {author}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatDate(c.created_at)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                    {body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
