import React, { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface AnalyticsTabProps {
  summary: any;
  videos: any[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ summary, videos }) => {
  const [timeRange, setTimeRange] = useState<'28D' | '90D' | '365D'>('28D');

  const totalViews = summary?.total_views || 0;
  const estimatedWatchHours = Math.round((totalViews * 2.8) / 60);
  const avgDuration = '2m 48s';
  const totalRevenue = summary?.total_earnings || 0;
  const subscribers = summary?.subscriber_count || 0;

  // Demographic & Traffic Mockups calibrated for Rwandan music industry
  const trafficSources = [
    { name: 'Direct Links / WhatsApp', value: 42, color: '#FFB300' },
    { name: 'PAYTUNE Search & Feed', value: 30, color: '#3B82F6' },
    { name: 'YouTube / Instagram', value: 18, color: '#10B981' },
    { name: 'External & Diaspora Blogs', value: 10, color: '#A855F7' }
  ];

  const geographicData = [
    { country: 'Rwanda (Kigali, Huye, Musanze)', share: '68%', views: Math.round(totalViews * 0.68) },
    { country: 'United States (Diaspora)', share: '14%', views: Math.round(totalViews * 0.14) },
    { country: 'Belgium & France', share: '8%', views: Math.round(totalViews * 0.08) },
    { country: 'Uganda & Kenya', share: '6%', views: Math.round(totalViews * 0.06) },
    { country: 'Canada', share: '4%', views: Math.round(totalViews * 0.04) }
  ];

  const devicesData = [
    { device: 'Mobile Smartphone (MTN/Airtel 4G)', percent: 84, icon: Smartphone },
    { device: 'Desktop / Laptop', percent: 12, icon: Monitor },
    { device: 'Tablet & Smart TV', percent: 4, icon: Tablet }
  ];

  // Daily views & watch time trend
  const trendData = [
    { date: 'Day 1', views: 420, watchMins: 980 },
    { date: 'Day 5', views: 760, watchMins: 1840 },
    { date: 'Day 10', views: 1150, watchMins: 2900 },
    { date: 'Day 15', views: 980, watchMins: 2450 },
    { date: 'Day 20', views: 1420, watchMins: 3600 },
    { date: 'Day 25', views: 1850, watchMins: 4700 },
    { date: 'Day 28', views: 2200, watchMins: 5800 }
  ];

  const handleExportCSV = () => {
    const rows = [
      ['Video Title', 'Category', 'Views', 'Purchases', 'Total Earned (RWF)'],
      ...(videos || []).map(v => [
        `"${v.title}"`,
        v.category || 'Afrobeat',
        v.views || 0,
        v.buyers_count || 0,
        v.total_earned || 0
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
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
            Insights on viewership velocity, audience retention, and geographic reach
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#1F1F1F] p-1 rounded-xl flex items-center border border-white/5">
            {(['28D', '90D', '365D'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-all"
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
          <span className="text-[11px] text-emerald-400 font-semibold">+22% growth</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Watch Time</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {estimatedWatchHours.toLocaleString()} <span className="text-xs font-normal text-gray-400">Hours</span>
          </h3>
          <span className="text-[11px] text-emerald-400 font-semibold">+15% watch time</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Avg View Duration</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">{avgDuration}</h3>
          <span className="text-[11px] text-gray-400 font-semibold">68% avg retention</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFB300] mb-1">
            <DollarSign className="w-4 h-4 text-[#FFB300]" />
            <span>Total Revenue</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#FFB300]">
            {totalRevenue.toLocaleString()} <span className="text-xs font-bold text-gray-400">RWF</span>
          </h3>
          <span className="text-[11px] text-emerald-400 font-semibold">+24% revenue</span>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Followers</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {subscribers.toLocaleString()}
          </h3>
          <span className="text-[11px] text-emerald-400 font-semibold">+34 new followers</span>
        </div>
      </div>

      {/* 3. Views & Watch Time Trend Graph */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="font-bold text-base text-white">Audience Retention & Velocity</h3>
          <p className="text-xs text-gray-400">Combined view count and watch minute trajectory</p>
        </div>

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
                  color: '#FFFFFF'
                }}
              />
              <Area type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={3} fill="url(#colorViewsTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Audience Geography & Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Traffic Sources</h3>
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
                    color: '#FFF'
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
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ts.color }} />
                  <span className="text-gray-300">{ts.name}</span>
                </div>
                <span className="font-bold text-white">{ts.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Reach */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#FFB300]" />
            <h3 className="font-bold text-base text-white">Top Geographic Markets</h3>
          </div>
          <div className="divide-y divide-white/5">
            {geographicData.map((geo) => (
              <div key={geo.country} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">{geo.country}</span>
                  <span className="text-gray-500 text-[11px]">{geo.views.toLocaleString()} views</span>
                </div>
                <span className="font-bold text-[#FFB300] bg-amber-500/10 px-2 py-0.5 rounded">
                  {geo.share}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Distribution */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Device Breakdown</h3>
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
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${d.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
