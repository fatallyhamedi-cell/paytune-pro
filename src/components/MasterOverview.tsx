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
  Sparkles
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
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
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
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
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
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-Approval: {stats?.auto_approve_artists ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 Platform Stats Cards (4-column grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Platform Revenue (Owner Share) */}
        <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Net Platform Revenue</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {stats ? Number(stats.total_revenue).toLocaleString() : "0"}{" "}
            <span className="text-xs font-bold text-amber-400">RWF</span>
          </p>
          <div className="mt-2 flex items-center text-xs text-neutral-400">
            <span className="text-emerald-400 font-bold mr-1">30%</span> owner net commission
          </div>
        </div>

        {/* 2. Total Gross Volume (GMV) */}
        <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-neutral-700 transition-all">
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
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-amber-400 transition-colors">
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
            <span className="text-amber-400 font-medium mr-1 flex items-center">
              Manage <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 4. Total Users */}
        <div
          onClick={() => onNavigateTab("users")}
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-amber-400 transition-colors">
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
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-amber-400 transition-colors">
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
          className="p-4 rounded-2xl bg-[#161616] border border-neutral-800/80 hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-amber-400 transition-colors">
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
              ? "bg-amber-500/5 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-500/5"
              : "bg-[#161616] border-neutral-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 group-hover:text-amber-400 transition-colors">
              Pending Artist Approvals
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-amber-400">
            {stats ? stats.pending_approvals : 0}
          </p>
          <div className="mt-2 flex items-center text-xs font-semibold text-amber-400">
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
                      ? "bg-amber-500 text-neutral-950 font-bold shadow"
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
                className="text-xs text-amber-400 hover:underline cursor-pointer"
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
                  <span className="font-bold text-amber-400 ml-2 whitespace-nowrap">
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
                className="text-xs text-amber-400 hover:underline cursor-pointer"
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
                className="text-xs text-amber-400 hover:underline cursor-pointer"
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
                  <span className="font-bold text-amber-400 ml-2 whitespace-nowrap">
                    {Number(u.total_spent).toLocaleString()} RWF
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
