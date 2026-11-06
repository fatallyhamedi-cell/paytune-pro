import React from "react";
import {
  Users,
  UserCheck,
  Video,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowDownCircle,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  Sparkles,
  Eye,
  Film
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { MasterStats, RevenueData, ActivityItem } from "../hooks/useMasterStats";

interface MasterOverviewProps {
  stats: MasterStats | null;
  revenue: RevenueData | null;
  revenuePeriod: "day" | "week" | "month" | "year";
  onChangePeriod: (period: "day" | "week" | "month" | "year") => void;
  activities: ActivityItem[];
  topContent: any;
  loading: boolean;
  onNavigateTab: (tab: any) => void;
  onQuickApproveAll?: () => void;
  onBatchProcessWithdrawals?: () => void;
  onToggleAutoApprove?: () => void;
}

export const MasterOverview: React.FC<MasterOverviewProps> = ({
  stats,
  revenue,
  revenuePeriod,
  onChangePeriod,
  activities,
  topContent,
  loading,
  onNavigateTab,
  onQuickApproveAll,
  onBatchProcessWithdrawals,
  onToggleAutoApprove
}) => {
  const [analytics, setAnalytics] = React.useState<{ totalPlatformViews: number; totalVideos: number; videos: any[] } | null>(null);

  React.useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("master_token") || localStorage.getItem("paytune_token");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/master/analytics", { headers });
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (e) {
        console.warn("Analytics fetch error:", e);
      }
    };
    fetchAnalytics();
  }, []);

  // Format graph data for Recharts
  const chartData = (revenue?.labels || []).map((label, idx) => ({
    name: label,
    revenue: revenue?.values?.[idx] || 0,
    gross: revenue?.gross_values?.[idx] || (revenue?.values?.[idx] || 0) * 3.3
  }));

  return (
    <div id="master-overview-container" className="space-y-6">
      {/* Top Banner / Quick Action Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-[#1A1A1A] to-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-600/20 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Platform Health: Optimal</h3>
            <p className="text-xs text-neutral-400">
              Real-time payment splits (70% Artist / 30% Platform), VAT auto-collected at 5%.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {stats && stats.pending_approvals > 0 && onQuickApproveAll && (
            <button
              id="btn-overview-quick-approve"
              onClick={onQuickApproveAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve All Artists ({stats.pending_approvals})</span>
            </button>
          )}

          {stats && stats.pending_withdrawals > 0 && onBatchProcessWithdrawals && (
            <button
              id="btn-overview-batch-withdraw"
              onClick={onBatchProcessWithdrawals}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>Disburse Withdrawals ({stats.pending_withdrawals})</span>
            </button>
          )}

          {onToggleAutoApprove && (
            <button
              id="btn-overview-auto-approve-toggle"
              onClick={onToggleAutoApprove}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                stats?.auto_approve_artists
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Auto-Approval: {stats?.auto_approve_artists ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Platform Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Platform Views (Video Analytics) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#161616] border border-purple-600/30 hover:border-purple-600 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Total Platform Views
            </span>
            <div className="p-2 rounded-xl bg-purple-600/10 text-purple-600">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {analytics
              ? analytics.totalPlatformViews.toLocaleString()
              : ((stats as any)?.total_views || 0).toLocaleString()}
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-neutral-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mr-1" />
            Across all {analytics ? analytics.totalVideos : (stats?.total_videos || 0)} published videos
          </div>
        </div>

        {/* 1. Total Platform Revenue (Owner Share) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800/80 hover:border-purple-600/30 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">Net Platform Revenue</span>
            <div className="p-2 rounded-xl bg-purple-600/10 text-purple-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {stats ? Number(stats.total_revenue).toLocaleString() : "0"}{" "}
            <span className="text-xs font-bold text-purple-600">RWF</span>
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-neutral-400">
            <span className="text-emerald-500 font-bold mr-1">30%</span> owner net commission
          </div>
        </div>

        {/* 2. Total Gross Volume (GMV) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800/80 hover:border-neutral-700 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Gross Sales Volume (GMV)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? Number(stats.total_volume || stats.total_revenue * 3.3).toLocaleString() : "0"}{" "}
            <span className="text-xs font-bold text-blue-400">RWF</span>
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            Across all Rwandan video purchases
          </div>
        </div>

        {/* 3. Total Artists */}
        <div
          onClick={() => onNavigateTab("artists")}
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-purple-600/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-purple-400 transition-colors">
              Total Artists
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? stats.total_artists : 0}
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            <span className="text-purple-400 font-medium mr-1 flex items-center">
              Manage <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 4. Total Users */}
        <div
          onClick={() => onNavigateTab("users")}
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-purple-600/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-purple-400 transition-colors">
              Registered Users
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? stats.total_users : 0}
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            Active consumers & fans
          </div>
        </div>

        {/* 5. Total Videos */}
        <div
          onClick={() => onNavigateTab("videos")}
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-purple-600/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-purple-400 transition-colors">
              Total Videos
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? stats.total_videos : 0}
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            Exclusive & trending catalog
          </div>
        </div>

        {/* 6. Total Purchases */}
        <div
          onClick={() => onNavigateTab("payments")}
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-purple-600/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-purple-400 transition-colors">
              Total Purchases
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? stats.total_purchases : 0}
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            Completed transactions
          </div>
        </div>

        {/* 7. Pending Approvals */}
        <div
          onClick={() => onNavigateTab("artists")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
            stats && stats.pending_approvals > 0
              ? "bg-purple-600/5 border-purple-600/40 hover:border-purple-400 shadow-md shadow-purple-600/5"
              : "bg-[#161616] border-neutral-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-purple-400 transition-colors">
              Pending Artist Approvals
            </span>
            <div className="p-2 rounded-xl bg-purple-600/15 text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-purple-400">
            {stats ? stats.pending_approvals : 0}
          </p>
          <div className="mt-2 flex items-center text-xs font-semibold text-purple-400">
            {stats && stats.pending_approvals > 0 ? "Action required →" : "All artists up to date"}
          </div>
        </div>

        {/* 8. Pending Withdrawals */}
        <div
          onClick={() => onNavigateTab("withdrawals")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
            stats && stats.pending_withdrawals > 0
              ? "bg-red-500/5 border-red-500/40 hover:border-red-400 shadow-md shadow-red-500/5"
              : "bg-[#161616] border-neutral-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-red-400 transition-colors">
              Pending Withdrawals
            </span>
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-red-400">
            {stats ? stats.pending_withdrawals : 0}
          </p>
          <div className="mt-2 flex items-center text-xs font-semibold text-red-400">
            {stats && stats.pending_withdrawals > 0 ? "Requires payout →" : "No pending payouts"}
          </div>
        </div>
      </div>

      {/* Revenue Graph & Action Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Graph (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#161616] border border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Revenue Performance</h3>
              <p className="text-xs text-neutral-400">
                Gross sales vs Platform 30% revenue share
              </p>
            </div>
            {/* Period selector tabs */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["day", "week", "month", "year"] as const).map(period => (
                <button
                  key={period}
                  id={`btn-period-${period}`}
                  onClick={() => onChangePeriod(period)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                    revenuePeriod === period
                      ? "bg-purple-600 text-neutral-950 font-bold shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFB300" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FFB300" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#737373" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#737373"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F1F1F",
                    borderColor: "#404040",
                    borderRadius: 12,
                    fontSize: 12
                  }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} RWF`]}
                />
                <Area
                  type="monotone"
                  dataKey="gross"
                  name="Gross GMV"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGross)"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Platform Revenue"
                  stroke="#FFB300"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Activity Feed (1 col) */}
        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Recent Activity</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-72 pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-8">No recent events recorded</p>
            ) : (
              activities.map(act => (
                <div key={act.id} className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-neutral-200">{act.title}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${act.badgeColor}`}>
                      {act.badge}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">{act.description}</p>
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Content Row: Best-Selling Videos, Top Artists, Top Users */}
      {topContent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top 5 Videos */}
          <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Top Best-Selling Videos</h3>
              <button
                onClick={() => onNavigateTab("videos")}
                className="text-xs text-purple-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>
            <div className="space-y-2.5">
              {(topContent.top_videos || []).slice(0, 5).map((v: any, i: number) => (
                <div key={v.id || i} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/50 last:border-0">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono text-neutral-500 font-bold w-4 text-center">{i + 1}</span>
                    <img
                      src={v.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120"}
                      alt={v.title}
                      className="w-10 h-7 object-cover rounded"
                      referrerPolicy="no-referrer"
                    />
                    <div className="truncate">
                      <p className="font-semibold text-white truncate">{v.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{v.artist_name}</p>
                    </div>
                  </div>
                  <span className="font-bold text-purple-400 ml-2 whitespace-nowrap">
                    {Number(v.earnings || v.views * 300).toLocaleString()} RWF
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Artists */}
          <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Top Artists by Earnings</h3>
              <button
                onClick={() => onNavigateTab("artists")}
                className="text-xs text-purple-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>
            <div className="space-y-2.5">
              {(topContent.top_artists || []).slice(0, 5).map((a: any, i: number) => (
                <div key={a.id || i} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/50 last:border-0">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono text-neutral-500 font-bold w-4 text-center">{i + 1}</span>
                    <img
                      src={a.profile_image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                      alt={a.full_name}
                      className="w-7 h-7 rounded-full object-cover border border-neutral-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="truncate">
                      <p className="font-semibold text-white truncate">{a.full_name}</p>
                      <p className="text-[10px] text-neutral-400">{a.video_count} videos</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400 ml-2 whitespace-nowrap">
                    {Number(a.total_earnings).toLocaleString()} RWF
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Users */}
          <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Top Supporters & Fans</h3>
              <button
                onClick={() => onNavigateTab("users")}
                className="text-xs text-purple-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>
            <div className="space-y-2.5">
              {(topContent.top_users || []).slice(0, 5).map((u: any, i: number) => (
                <div key={u.id || i} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/50 last:border-0">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono text-neutral-500 font-bold w-4 text-center">{i + 1}</span>
                    <div className="truncate">
                      <p className="font-semibold text-white truncate">{u.name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  <span className="font-bold text-purple-400 ml-2 whitespace-nowrap">
                    {Number(u.total_spent).toLocaleString()} RWF
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Analytics Section: Views per Video Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-600" />
              Platform Video Analytics (Views per Video)
            </h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Ranked list of published Rwandan tracks by total audience reach and stream views
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("videos")}
            className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            Manage Videos <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-neutral-800/60 text-gray-500 dark:text-neutral-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Video Title</th>
                <th className="py-2.5 px-3">Artist</th>
                <th className="py-2.5 px-3 text-right">Views</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/70">
              {analytics && analytics.videos.length > 0 ? (
                analytics.videos.slice(0, 10).map((v, i) => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-gray-500 dark:text-neutral-400">
                      #{i + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={v.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120"}
                          alt={v.title}
                          className="w-10 h-7 object-cover rounded bg-neutral-800"
                        />
                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
                          {v.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-neutral-300 font-medium">
                      {v.artist_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-white">
                      {v.views.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-700 dark:text-neutral-300">
                      {v.is_free ? 'FREE' : `${Number(v.price_rwf || 0).toLocaleString()} RWF`}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.is_free
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400'
                      }`}>
                        {v.is_free ? 'Free' : 'Pay-Per-View'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No videos available for analytics
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
