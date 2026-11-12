import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Heart,
  Share2,
  BarChart2,
  Send,
  Sparkles,
  CheckCircle2,
  Users,
  Image as ImageIcon,
  Flame,
  Award
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface CommunityPost {
  id: string;
  author_name: string;
  author_handle: string;
  author_avatar: string;
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
  is_liked?: boolean;
}

const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    author_name: 'Bruce Melodie',
    author_handle: 'brucemelodie',
    author_avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80',
    is_verified: true,
    time_ago: '2 hours ago',
    content: 'Kigali Arena! We are performing live this Saturday on PayTune Live. Who has already grabbed their virtual ticket? Let me know which song you want on the setlist! 🇷🇼🔥',
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
    likes: 1240,
    comments_count: 86,
  },
  {
    id: 'post-2',
    author_name: 'Israel Mbonyi',
    author_handle: 'israelmbonyi',
    author_avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&auto=format&fit=crop&q=80',
    is_verified: true,
    time_ago: '5 hours ago',
    content: 'Praise God everyone! Which worship track spoke most to your heart this month? Vote below:',
    poll: {
      question: 'Your favorite worship track this month:',
      options: [
        { text: 'Ni Wowe Mwami', votes: 4120 },
        { text: 'Baho', votes: 2350 },
        { text: 'Hari Ubuzima', votes: 1980 },
        { text: 'Yankuye Kure', votes: 1420 },
      ],
      total_votes: 9870,
    },
    likes: 3890,
    comments_count: 312,
  },
  {
    id: 'post-3',
    author_name: 'Burna Boy',
    author_handle: 'burnaboygram',
    author_avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&auto=format&fit=crop&q=80',
    is_verified: true,
    time_ago: '1 day ago',
    content: 'Love to all our fans streaming the new African Giants discography on PayTune. Pan-African unity through music! 🌍✨',
    likes: 8420,
    comments_count: 520,
  },
];

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);
  const [newPostText, setNewPostText] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});

  const handleLike = (id: string) => {
    const next = new Set(likedPosts);
    if (next.has(id)) {
      next.delete(id);
      setPosts(
        posts.map((p) => (p.id === id ? { ...p, likes: p.likes - 1 } : p))
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

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      author_name: user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Creator'),
      author_handle: user?.email ? user.email.split('@')[0] : 'creator',
      author_avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || 'U')}&background=8B5CF6&color=fff`,
      is_verified: true,
      time_ago: 'Just now',
      content: newPostText.trim(),
      likes: 0,
      comments_count: 0,
    };

    setPosts([newPost, ...posts]);
    setNewPostText('');
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
          Direct updates, behind-the-scenes moments, interactive polls, and announcements from your favorite creators.
        </p>
      </div>

      {/* Create Post Box */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1">
            <textarea
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="Share an announcement, poll, or update with your fans..."
              rows={3}
              className="w-full p-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 text-sm focus:outline-none focus:border-purple-600 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
              <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Image
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
              <BarChart2 className="w-3.5 h-3.5 text-[#FFB300]" /> Poll
            </span>
          </div>

          <button
            type="button"
            onClick={handleCreatePost}
            disabled={!newPostText.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Posts Stream */}
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
                  <img
                    src={post.author_avatar}
                    alt={post.author_name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 text-sm">{post.author_name}</span>
                      {post.is_verified && (
                        <CheckCircle2 className="w-4 h-4 text-purple-600 fill-white" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      @{post.author_handle} • {post.time_ago}
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
                        className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold relative overflow-hidden transition-all ${
                          isUserChoice
                            ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold'
                            : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        {hasVoted && (
                          <div
                            className="absolute inset-y-0 left-0 bg-purple-100 opacity-60 pointer-events-none"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <div className="relative z-10 flex items-center justify-between">
                          <span>{opt.text}</span>
                          {hasVoted && <span className="font-mono text-purple-700">{pct}%</span>}
                        </div>
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
    </div>
  );
}
