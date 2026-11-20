import React, { useState, useEffect } from 'react';
import {
  Eye,
  Clock,
  Users,
  TrendingUp,
  DollarSign,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Download,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../lib/api';

interface AnalyticsTabProps {
  summary: any;
  videos: any[];
}

const SOURCE_COLORS = ['#FFB300', '#3B82F6', '#10B981', '#A855F7', '#EC4899'];

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ summary, videos }) => {
  const [timeRange, setTimeRange] = useState<'28D' | '90D' | '365D'>('28D');
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const rangeParam = timeRange === '365D' ? '365d' : timeRange === '90D' ? '90d' : '28d';
    setLoading(true);
    api
      .get(`/api/artist/analytics?range=${rangeParam}`)
      .then((res) => {
        if (active) setAnalyticsData(res.data || null);
      })
      .catch((err) => {
        console.warn('Analytics load error:', err?.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [timeRange]);

  const totalViews = Number(analyticsData?.summary?.total_views ?? summary?.total_views ?? 0);
  const totalWatchMins = Number(
    analyticsData?.summary?.total_watch_time_minutes ?? analyticsData?.total_watch_minutes ?? 0
  );
  const watchTimeHours = Number((totalWatchMins / 60).toFixed(1));
  const avgDuration = analyticsData?.summary?.avg_view_duration || '0m 0s';
  const totalRevenue = Number(analyticsData?.summary?.total_earnings ?? summary?.total_earnings ?? 0);
  const subscribers = Number(analyticsData?.summary?.subscribers_gained ?? summary?.subscriber_count ?? 0);
  const realtimeViewers = Number(analyticsData?.summary?.realtime_active_viewers ?? 0);

  const rawTrend = Array.isArray(analyticsData?.views_over_time) ? analyticsData.views_over_time : [];
  const trendData = rawTrend.map((point: any) => ({
    date: point.date,
    views: Number(point.views || 0),
    earnings: Number(point.earnings || 0),
  }));

  const rawSources = Array.isArray(analyticsData?.demographics?.traffic_sources)
    ? analyticsData.demographics.traffic_sources
    : [];
  const trafficSources = rawSources.map((s: any, idx: number) => ({
    name: s.source || 'Direct',
    value: Number(s.percent || 0),
    color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
  }));

  const rawCountries = Array.isArray(analyticsData?.demographics?.countries)
    ? analyticsData.demographics.countries
    : [];
  const geographicData = rawCountries.map((g: any) => ({
    country: g.name || 'Unknown',
    share: `${Number(g.percent || 0)}%`,
    views: Math.round((totalViews * Number(g.percent || 0)) / 100),
  }));

  const rawDevices = Array.isArray(analyticsData?.demographics?.devices)
    ? analyticsData.demographics.devices
    : [];
  const devicesData = rawDevices.map((d: any) => {
    const label = String(d.device || 'Web Browser');
    const lower = label.toLowerCase();
    const icon = lower.includes('mobile') || lower.includes('phone') || lower.includes('android') || lower.includes('ios')
      ? Smartphone
      : lower.includes('tablet') || lower.includes('tv')
      ? Tablet
      : Monitor;
    return {
      device: label,
      percent: Number(d.percent || 0),
      icon,
    };
  });

  const handleExportCSV = () => {
    const rows = [
      ['Video Title', 'Category', 'Views', 'Purchases', 'Total Earned (RWF)'],
      ...(videos || []).map((v) => [
        `"${v.title}"`,
        v.category || 'Afrobeat',
        v.views || 0,
        v.buyers_count || 0,
        v.total_earned || 0,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `paytune_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Channel Analytics & Demographics</h2>
          <p className="text-xs text-gray-400">
            Live viewership, watch duration, and audience metrics from Supabase analytics logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#1F1F1F] p-1 rounded-xl flex items-center border border-white/5">
            {(['28D', '90D', '365D'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-[#FFB300] text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Last {r}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metric Cards (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Total Views</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {totalViews.toLocaleString()}
          </h3>
          <span className="text-[11px] text-gray-400 font-semibold">
            {realtimeViewers > 0 ? `${realtimeViewers} active now` : `Last ${timeRange}`}
          </span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Watch Time</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {watchTimeHours.toLocaleString()} <span className="text-xs font-normal text-gray-400">Hours</span>
          </h3>
          <span className="text-[11px] text-gray-400 font-semibold">
            {totalWatchMins.toLocaleString()} min recorded
          </span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span>Avg View Duration</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">{avgDuration}</h3>
          <span className="text-[11px] text-gray-400 font-semibold">Per recorded playback</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFB300] mb-1">
            <DollarSign className="w-4 h-4 text-[#FFB300]" />
            <span>Total Revenue</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#FFB300]">
            {totalRevenue.toLocaleString()} <span className="text-xs font-bold text-gray-400">RWF</span>
          </h3>
          <span className="text-[11px] text-gray-400 font-semibold">70% creator share</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Followers</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {subscribers.toLocaleString()}
          </h3>
          <span className="text-[11px] text-gray-400 font-semibold">Verified subscribers</span>
        </div>
      </div>

      {/* 3. Views & Watch Time Trend Graph */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Audience Retention & Velocity</h3>
            <p className="text-xs text-gray-400">Daily view trajectory across the selected timeframe</p>
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
        </div>

        {trendData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
            No daily analytics points recorded yet for the last {timeRange}.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViewsTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="date" stroke="#666666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A1A',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                  }}
                />
                <Area type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={3} fill="url(#colorViewsTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4. Audience Geography & Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Traffic Sources</h3>
          {trafficSources.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No traffic referrer events logged yet.</p>
          ) : (
            <>
              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trafficSources}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {trafficSources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1A',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Traffic Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {trafficSources.map((ts) => (
                  <div key={ts.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-purple-500"
                        ref={(el) => {
                          if (el && ts.color) el.style.backgroundColor = ts.color;
                        }}
                      />
                      <span className="text-gray-300">{ts.name}</span>
                    </div>
                    <span className="font-bold text-white">{ts.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Geographic Reach */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#FFB300]" />
            <h3 className="font-bold text-base text-white">Top Geographic Markets</h3>
          </div>
          {geographicData.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No regional view events logged yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {geographicData.map((geo) => (
                <div key={geo.country} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white block">{geo.country}</span>
                    <span className="text-gray-500 text-[11px]">{geo.views.toLocaleString()} views</span>
                  </div>
                  <span className="font-bold text-[#FFB300] bg-purple-600/10 px-2 py-0.5 rounded">
                    {geo.share}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device Distribution */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Device Breakdown</h3>
          {devicesData.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No playback device telemetry logged yet.</p>
          ) : (
            <div className="space-y-4 pt-2">
              {devicesData.map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.device} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">{d.device}</span>
                      </div>
                      <span className="font-bold text-white">{d.percent}%</span>
                    </div>
                    <progress
                      value={d.percent}
                      max={100}
                      className="w-full h-2 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-black/40 [&::-webkit-progress-value]:bg-purple-600 [&::-moz-progress-bar]:bg-purple-600"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
