import React, { useState } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  Eye, 
  Users, 
  Video, 
  Clock, 
  ArrowUpRight, 
  Upload, 
  Radio, 
  BarChart3, 
  ShoppingBag, 
  MessageSquare, 
  Calendar,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface OverviewTabProps {
  summary: any;
  earningsGraph: any;
  videos: any[];
  recentActivity: any[];
  onOpenUpload: () => void;
  onOpenWithdraw: () => void;
  onNavigateTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  summary,
  earningsGraph,
  videos,
  recentActivity,
  onOpenUpload,
  onOpenWithdraw,
  onNavigateTab
}) => {
  const [graphTimeframe, setGraphTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [graphMetric, setGraphMetric] = useState<'earned' | 'views'>('earned');

  const chartData = earningsGraph ? earningsGraph[graphTimeframe] || [] : [];

  // Top 5 videos sorted by earned / views
  const topVideos = [...(videos || [])]
    .sort((a, b) => (b.total_earned || b.views || 0) - (a.total_earned || a.views || 0))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* 1. Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Earnings */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Earnings (70%)
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FFB300] group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {(summary?.total_earnings || 0).toLocaleString()}{' '}
              <span className="text-xs font-bold text-gray-400">RWF</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs last month</span>
            </div>
          </div>
        </div>

        {/* Card 2: Current Balance (Available for Withdrawal) */}
        <div className="bg-[#161616] border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider">
              Available Balance
            </span>
            <button
              onClick={onOpenWithdraw}
              className="px-2.5 py-1 rounded-lg bg-[#FFB300] text-black text-xs font-black hover:bg-[#ffc107] transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              Withdraw
            </button>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-[#FFB300]">
              {(summary?.current_balance || 0).toLocaleString()}{' '}
              <span className="text-xs font-bold text-gray-400">RWF</span>
            </h3>
            <p className="text-xs text-gray-400 pt-1">
              Ready for immediate Mobile Money payout
            </p>
          </div>
        </div>

        {/* Card 3: Pending Balance */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Views
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {(summary?.total_views || 0).toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold pt-1">
              <Users className="w-3.5 h-3.5" />
              <span>{(summary?.subscriber_count || 0).toLocaleString()} Followers</span>
            </div>
          </div>
        </div>

        {/* Card 4: Video Catalog */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Uploaded Releases
            </span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
              <Video className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {(summary?.video_count || videos?.length || 0).toLocaleString()}
            </h3>
            <p className="text-xs text-gray-400 pt-1">
              Active music videos & concert recordings
            </p>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Bar */}
      <div className="bg-gradient-to-r from-[#1A1A1A] to-[#141414] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-[#FFB300]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-white text-base">Creator Quick Launch</h4>
            <p className="text-xs text-gray-400">Streamline your release pipeline and engage Rwandan fans</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenUpload}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#FFB300] text-black font-black text-xs hover:bg-[#ffc107] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Release</span>
          </button>

          <button
            onClick={() => onNavigateTab('live')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4" />
            <span>Go Live</span>
          </button>

          <button
            onClick={() => onNavigateTab('analytics')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span>View Analytics</span>
          </button>
        </div>
      </div>

      {/* 3. Earnings & Views Trend Graph */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">Performance Trajectory</h3>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase">
                Interactive
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Track your revenue stream and fan engagement across timeline intervals
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric toggle */}
            <div className="bg-[#1F1F1F] p-1 rounded-xl flex items-center border border-white/5">
              <button
                onClick={() => setGraphMetric('earned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  graphMetric === 'earned'
                    ? 'bg-[#FFB300] text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Revenue (RWF)
              </button>
              <button
                onClick={() => setGraphMetric('views')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  graphMetric === 'views'
                    ? 'bg-[#FFB300] text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Views
              </button>
            </div>

            {/* Timeframe selector */}
            <div className="bg-[#1F1F1F] p-1 rounded-xl flex items-center border border-white/5">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setGraphTimeframe(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    graphTimeframe === t
                      ? 'bg-white/15 text-white font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recharts Area Container */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB300" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FFB300" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#666666" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#666666" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => 
                  graphMetric === 'earned'
                    ? val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                    : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF'
                }}
                formatter={(val: any) => [
                  graphMetric === 'earned'
                    ? `${Number(val).toLocaleString()} RWF`
                    : Number(val).toLocaleString(),
                  graphMetric === 'earned' ? 'Your 70% Share' : 'Video Views'
                ]}
              />
              <Area
                type="monotone"
                dataKey={graphMetric}
                stroke={graphMetric === 'earned' ? '#FFB300' : '#3B82F6'}
                strokeWidth={3}
                fillOpacity={1}
                fill={graphMetric === 'earned' ? 'url(#colorRevenue)' : 'url(#colorViews)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Two-Column Grid: Top Videos & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Videos (2 cols) */}
        <div className="lg:col-span-2 bg-[#161616] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white">Top Performing Releases</h3>
              <p className="text-xs text-gray-400">Content generating highest engagement and sales</p>
            </div>
            <button
              onClick={() => onNavigateTab('videos')}
              className="text-xs font-bold text-[#FFB300] hover:underline flex items-center gap-1"
            >
              <span>Manage all ({videos?.length || 0})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {topVideos.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No videos uploaded yet. Click Upload to publish your first track!
              </div>
            ) : (
              topVideos.map((video, idx) => (
                <div key={video.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-500 w-4">{idx + 1}</span>
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-14 h-9 object-cover rounded-md border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-9 rounded-md bg-neutral-800 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                        ▶
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{video.title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {video.views?.toLocaleString() || 0} views • {video.category || 'Afrobeat'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-[#FFB300]">
                      {(video.total_earned || 0).toLocaleString()} RWF
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      {video.is_free ? 'Free' : `${(video.price_rwf || 0).toLocaleString()} RWF/view`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Activity Feed (1 col) */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-white">Live Activity</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-[#1A1A1A] border border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {act.type === 'purchase' && <ShoppingBag className="w-3.5 h-3.5 text-[#FFB300]" />}
                      {act.type === 'comment' && <MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
                      {act.type === 'payout' && <Wallet className="w-3.5 h-3.5 text-purple-400" />}
                      {act.title}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-300 leading-snug">{act.description}</p>
                  <div className="text-[10px] text-gray-500 pt-0.5">
                    {act.user_identifier}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-500 text-xs">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
