import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Heart,
  Share2,
  BarChart2,
  Send,
  CheckCircle2,
  Users,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface CommunityPost {
  id: string;
  author_name: string;
  author_handle: string;
  author_avatar?: string;
  is_verified: boolean;
  time_ago: string;
  content: string;
  image_url?: string;
  poll?: {
    question: string;
    options: { text: string; votes: number }[];
    total_votes: number;
    user_voted_index?: number;
  };
  likes: number;
  comments_count: number;
}

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPostText, setNewPostText] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const loadFeed = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbErr } = await supabase
          .from('artist_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!active) return;

        if (dbErr) {
          // Table may not be provisioned yet; show clean empty feed rather than fabricated posts
          setPosts([]);
        } else if (Array.isArray(data)) {
          setPosts(
            data.map((row: any) => ({
              id: String(row.id),
              author_name: row.author_name || 'Creator',
              author_handle: row.author_handle || 'creator',
              author_avatar: row.author_avatar || '',
              is_verified: Boolean(row.is_verified),
              time_ago: row.created_at
                ? new Date(row.created_at).toLocaleDateString()
                : '',
              content: row.content || '',
              image_url: row.image_url || undefined,
              likes: Number(row.likes || 0),
              comments_count: Number(row.comments_count || 0),
            }))
          );
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Unable to load community feed.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFeed();
    return () => {
      active = false;
    };
  }, []);

  const handleLike = (id: string) => {
    const next = new Set(likedPosts);
    if (next.has(id)) {
      next.delete(id);
      setPosts(
        posts.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes - 1) } : p))
      );
    } else {
      next.add(id);
      setPosts(
        posts.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
      );
    }
    setLikedPosts(next);
  };

  const handleVote = (postId: string, optionIndex: number) => {
    if (votedPolls[postId] !== undefined) return;
    setVotedPolls({ ...votedPolls, [postId]: optionIndex });
    setPosts(
      posts.map((p) => {
        if (p.id !== postId || !p.poll) return p;
        const newOptions = [...p.poll.options];
        newOptions[optionIndex].votes += 1;
        return {
          ...p,
          poll: {
            ...p.poll,
            options: newOptions,
            total_votes: p.poll.total_votes + 1,
            user_voted_index: optionIndex,
          },
        };
      })
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    if (!user) {
      setNotice('Please sign in to publish a community update.');
      return;
    }
    setNotice(null);

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      (user.email ? user.email.split('@')[0] : 'Creator');
    const handle = user.email ? user.email.split('@')[0] : 'creator';

    try {
      const { data, error: insertErr } = await supabase
        .from('artist_posts')
        .insert([
          {
            user_id: user.id,
            author_name: displayName,
            author_handle: handle,
            content: newPostText.trim(),
          },
        ])
        .select('*')
        .single();

      if (insertErr) {
        setNotice(
          'Community posts storage is not yet enabled on this workspace. Ask an administrator to enable artist_posts.'
        );
        return;
      }

      if (data) {
        setPosts((prev) => [
          {
            id: String(data.id),
            author_name: data.author_name || displayName,
            author_handle: data.author_handle || handle,
            author_avatar: data.author_avatar || '',
            is_verified: Boolean(data.is_verified),
            time_ago: 'Just now',
            content: data.content,
            likes: 0,
            comments_count: 0,
          },
          ...prev,
        ]);
        setNewPostText('');
      }
    } catch (err: any) {
      setNotice(err?.message || 'Unable to submit post.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 mb-2">
          <Users className="w-3.5 h-3.5" />
          <span>PayTune Community Feed</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Pan-African Creator & Fan Hub
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Direct updates, behind-the-scenes moments, and announcements from verified creators.
        </p>
      </div>

      {/* Create Post Box */}
      <form
        onSubmit={handleCreatePost}
        className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1">
            <textarea
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="Share an announcement or update with your fans..."
              rows={3}
              className="w-full p-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 text-sm focus:outline-none focus:border-purple-600 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50">
              <BarChart2 className="w-3.5 h-3.5 text-purple-600" /> Creator Updates
            </span>
          </div>

          <button
            type="submit"
            disabled={!newPostText.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </div>
      </form>

      {/* Posts Stream */}
      {loading ? (
        <div className="py-12 flex items-center justify-center text-gray-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span>Loading community updates...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center space-y-2">
          <Users className="w-10 h-10 text-purple-400 mx-auto" />
          <h2 className="text-base font-bold text-gray-900">No community posts yet</h2>
          <p className="text-xs text-gray-500">
            Updates published by creators will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isLiked = likedPosts.has(post.id);
            const hasVoted = votedPolls[post.id] !== undefined;

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4"
              >
                {/* Author Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {post.author_avatar ? (
                      <img
                        src={post.author_avatar}
                        alt={post.author_name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center">
                        {post.author_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-sm">{post.author_name}</span>
                        {post.is_verified && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600 fill-white" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        @{post.author_handle} {post.time_ago ? `• ${post.time_ago}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {post.content}
                </p>

                {/* Optional Post Image */}
                {post.image_url && (
                  <div className="rounded-xl overflow-hidden border border-gray-100 max-h-96">
                    <img
                      src={post.image_url}
                      alt="Community post attachment"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Optional Poll */}
                {post.poll && (
                  <div className="space-y-2 pt-1 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-2">{post.poll.question}</p>
                    {post.poll.options.map((opt, idx) => {
                      const pct = Math.round((opt.votes / (post.poll?.total_votes || 1)) * 100);
                      const isUserChoice = votedPolls[post.id] === idx;

                      return (
                        <button
                          key={opt.text}
                          type="button"
                          onClick={() => handleVote(post.id, idx)}
                          disabled={hasVoted}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold space-y-1 transition-all ${
                            isUserChoice
                              ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold'
                              : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{opt.text}</span>
                            {hasVoted && <span className="font-mono text-purple-700">{pct}%</span>}
                          </div>
                          {hasVoted && (
                            <progress
                              value={pct}
                              max={100}
                              className="w-full h-1.5 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-purple-100 [&::-webkit-progress-value]:bg-purple-600 [&::-moz-progress-bar]:bg-purple-600"
                            />
                          )}
                        </button>
                      );
                    })}
                    <p className="text-[11px] text-gray-400 pt-1">
                      {post.poll.total_votes.toLocaleString()} total votes
                    </p>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center gap-6 pt-2 border-t border-gray-100 text-xs font-semibold text-gray-500">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isLiked ? 'text-rose-600' : 'hover:text-gray-900'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    <span>{post.likes.toLocaleString()}</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.comments_count}</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer ml-auto">
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
