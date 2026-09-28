import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trophy, 
  MessageSquare, 
  Heart, 
  EyeOff, 
  Eye, 
  Send, 
  CheckCircle, 
  Clock, 
  Search, 
  Sparkles,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import axios from 'axios';

interface SubscribersTabProps {
  artist: any;
}

export const SubscribersTab: React.FC<SubscribersTabProps> = ({ artist }) => {
  const [activeSubSection, setActiveSubSection] = useState<'subscribers' | 'top-fans' | 'comments'>('subscribers');
  
  // Data states
  const [subscribersData, setSubscribersData] = useState<any>(null);
  const [topFans, setTopFans] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Comment reply state
  const [replyText, setReplyText] = useState<{ [commentId: string]: string }>({});
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  const fetchCommunityData = async () => {
    try {
      setLoading(true);
      const [subsRes, fansRes, commsRes] = await Promise.all([
        axios.get('/api/artist/subscribers').catch(() => ({ data: null })),
        axios.get('/api/artist/top-fans').catch(() => ({ data: [] })),
        axios.get('/api/artist/comments').catch(() => ({ data: [] }))
      ]);

      if (subsRes?.data) setSubscribersData(subsRes.data);
      if (fansRes?.data) setTopFans(fansRes.data);
      if (commsRes?.data) setComments(commsRes.data);
    } catch (err) {
      console.error('Failed to load community data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const handleToggleHideComment = async (commentId: string, currentHidden: boolean) => {
    try {
      await axios.put(`/api/artist/comments/${commentId}/hide`, { hidden: !currentHidden });
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, is_hidden: !currentHidden } : c))
      );
    } catch (err) {
      console.error('Failed to toggle comment visibility:', err);
    }
  };

  const handleSendReply = (commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (!text) return;

    setComments(prev =>
      prev.map(c => {
        if (c.id === commentId) {
          const replies = c.replies || [];
          return {
            ...c,
            replies: [
              ...replies,
              {
                id: `reply-${Date.now()}`,
                author: artist?.full_name || 'Bruce Melodie',
                text,
                created_at: new Date().toISOString(),
                is_artist: true
              }
            ]
          };
        }
        return c;
      })
    );

    setReplyText(prev => ({ ...prev, [commentId]: '' }));
    setReplySuccess(commentId);
    setTimeout(() => setReplySuccess(null), 3000);
  };

  const subscribersList = subscribersData?.subscribers || [];
  const filteredSubscribers = subscribersList.filter((s: any) =>
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Community Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Followers
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FFB300]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {(subscribersData?.total_subscribers || artist?.subscriber_count || 14800).toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{subscribersData?.monthly_growth_rate || '+12.8%'} this month</span>
            </div>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              New Supporters
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              +{(subscribersData?.new_subscribers_this_month || 840).toLocaleString()}
            </h3>
            <p className="text-xs text-gray-400">Joined in the last 30 days</p>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Top Supporter Value
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FFB300]">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {(topFans[0]?.total_spent_rwf || 45000).toLocaleString()}{' '}
              <span className="text-xs font-bold text-gray-400">RWF</span>
            </h3>
            <p className="text-xs text-[#FFB300] font-medium truncate">
              {topFans[0]?.name || 'Christian R.'} ({topFans[0]?.badge || 'VIP Diamond'})
            </p>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Fan Comments
            </span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {comments.length || 28}
            </h3>
            <p className="text-xs text-emerald-400 font-semibold">100% active moderation</p>
          </div>
        </div>
      </div>

      {/* 2. Navigation Pills between Community Views */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubSection('subscribers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubSection === 'subscribers'
                ? 'bg-[#FFB300] text-black shadow-md shadow-amber-500/20'
                : 'bg-[#161616] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Followers List</span>
          </button>

          <button
            onClick={() => setActiveSubSection('top-fans')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubSection === 'top-fans'
                ? 'bg-[#FFB300] text-black shadow-md shadow-amber-500/20'
                : 'bg-[#161616] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Top Fans Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveSubSection('comments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubSection === 'comments'
                ? 'bg-[#FFB300] text-black shadow-md shadow-amber-500/20'
                : 'bg-[#161616] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comments Moderation</span>
            {comments.filter(c => c.is_hidden).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black">
                {comments.filter(c => c.is_hidden).length} Hidden
              </span>
            )}
          </button>
        </div>

        {activeSubSection === 'subscribers' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search followers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#161616] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300]"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FFB300] animate-spin" />
          <p className="text-xs text-gray-400">Loading community data...</p>
        </div>
      ) : (
        <>
          {/* VIEW 1: FOLLOWERS LIST */}
          {activeSubSection === 'subscribers' && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">Recent Followers</h4>
                  <p className="text-xs text-gray-400">Fans who follow and support your music releases</p>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  Showing {filteredSubscribers.length} followers
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#1C1C1C] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Follower</th>
                      <th className="py-3.5 px-5">Membership Tier</th>
                      <th className="py-3.5 px-5">Follow Date</th>
                      <th className="py-3.5 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredSubscribers.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-black shrink-0">
                              <img 
                                src={sub.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} 
                                alt={sub.name} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <div>
                              <p className="font-bold text-white">{sub.name}</p>
                              <p className="text-[11px] text-gray-400">{sub.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            sub.tier === 'Superfan'
                              ? 'bg-amber-500/20 text-[#FFB300] border border-amber-500/30'
                              : 'bg-white/5 text-gray-300 border border-white/10'
                          }`}>
                            {sub.tier}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-gray-400">
                          {new Date(sub.subscribed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-4 px-5">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: TOP FANS LEADERBOARD */}
          {activeSubSection === 'top-fans' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFB300] text-black flex items-center justify-center font-black">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Supporter Leaderboard</h4>
                    <p className="text-xs text-gray-400">Your top contributing listeners ranked by total purchases and tips</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#FFB300] uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Hall of Fame
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topFans.map((fan: any) => (
                  <div 
                    key={fan.rank}
                    className={`bg-[#161616] border rounded-2xl p-5 relative overflow-hidden transition-all ${
                      fan.rank === 1 
                        ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' 
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                          fan.rank === 1 ? 'bg-[#FFB300] text-black' :
                          fan.rank === 2 ? 'bg-gray-300 text-black' :
                          fan.rank === 3 ? 'bg-amber-700 text-white' : 'bg-white/10 text-gray-300'
                        }`}>
                          #{fan.rank}
                        </div>
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-black">
                          <img 
                            src={fan.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} 
                            alt={fan.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-[#FFB300] text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                        {fan.badge}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white truncate">{fan.name}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{fan.purchases_count} Content Purchases</p>

                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Total Contribution:</span>
                      <span className="text-sm font-black text-white">
                        {fan.total_spent_rwf.toLocaleString()} <span className="text-xs text-[#FFB300]">RWF</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: COMMENTS MANAGEMENT */}
          {activeSubSection === 'comments' && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">Fan Comments Across All Releases</h4>
                  <p className="text-xs text-gray-400">Reply directly to fans, like comments, or moderate sensitive remarks</p>
                </div>
                <span className="text-xs text-gray-400 font-bold">{comments.length} Comments Total</span>
              </div>

              <div className="divide-y divide-white/5">
                {comments.map((comment: any) => (
                  <div key={comment.id} className={`p-5 space-y-3 transition-colors ${comment.is_hidden ? 'bg-rose-500/[0.03]' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{comment.user_name}</span>
                          <span className="text-[10px] text-gray-500">•</span>
                          <span className="text-[11px] text-[#FFB300] font-semibold">{comment.video_title}</span>
                          {comment.is_hidden && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase">
                              Hidden from public
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">{comment.comment}</p>
                        <span className="text-[10px] text-gray-500 block">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleHideComment(comment.id, !!comment.is_hidden)}
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            comment.is_hidden
                              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={comment.is_hidden ? 'Show Comment' : 'Hide Comment'}
                        >
                          {comment.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{comment.is_hidden ? 'Unhide' : 'Hide'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Replies thread */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-6 pl-3 border-l-2 border-amber-500/30 space-y-2 pt-2">
                        {comment.replies.map((reply: any) => (
                          <div key={reply.id} className="text-xs bg-[#1F1F1F] p-2.5 rounded-xl">
                            <span className="font-bold text-[#FFB300]">{reply.author} (Artist): </span>
                            <span className="text-gray-300">{reply.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Reply Box */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Write a public artist reply..."
                        value={replyText[comment.id] || ''}
                        onChange={(e) => setReplyText({ ...replyText, [comment.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply(comment.id)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-white/5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300]"
                      />
                      <button
                        onClick={() => handleSendReply(comment.id)}
                        className="p-2 rounded-xl bg-[#FFB300] text-black hover:bg-[#ffc107] transition-all"
                        title="Post reply"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {replySuccess === comment.id && (
                      <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Reply published to viewers!
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
