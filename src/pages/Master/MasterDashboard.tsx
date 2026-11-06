import React, { useState, useEffect } from 'react';
import { Eye, Video, RefreshCw, TrendingUp, Search, Play, ArrowUpRight, BarChart3, Film, ShieldCheck } from 'lucide-react';

interface VideoAnalyticsItem {
  id: string;
  title: string;
  artist_id?: string;
  artist_name: string;
  views: number;
  price_rwf: number;
  price_usd: number;
  is_free: boolean;
  thumbnail_url: string;
  uploaded_at: string;
}

interface AnalyticsData {
  totalPlatformViews: number;
  totalVideos: number;
  videos: VideoAnalyticsItem[];
}

export default function MasterDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('master_token') || localStorage.getItem('paytune_token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/master/analytics', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load analytics: HTTP ${res.status}`);
      }

      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('Error fetching master analytics:', err);
      setError(err.message || 'Unable to fetch video analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const filteredVideos = (data?.videos || []).filter((v) => {
    const q = searchQuery.toLowerCase();
    return v.title.toLowerCase().includes(q) || v.artist_name.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#161616]/90 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-600/20 text-purple-700 dark:text-purple-400 flex items-center justify-center font-black">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                  PAYTUNE Master Dashboard
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400 border border-purple-300 dark:border-purple-600/30">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Master Admin
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Platform-wide video performance, audience views & creator catalog
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Analytics'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchAnalytics()}
              className="underline font-bold text-xs ml-4 hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Analytics Highlights KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Total Platform Views */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                Total Platform Views
              </span>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-600/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-600/20">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              {loading ? (
                <span className="inline-block w-24 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
              ) : (
                (data?.totalPlatformViews || 0).toLocaleString()
              )}
            </p>
            <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
              <span>Cumulative views across all published Rwandan video tracks</span>
            </div>
          </div>

          {/* 2. Total Videos */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                Total Videos
              </span>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                <Video className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
              ) : (
                (data?.totalVideos || 0).toLocaleString()
              )}
            </p>
            <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Film className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
              <span>Active catalog of pay-per-view & free media assets</span>
            </div>
          </div>

          {/* 3. Average Views Per Video */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                Avg Views / Video
              </span>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              {loading ? (
                <span className="inline-block w-20 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
              ) : data && data.totalVideos > 0 ? (
                Math.round(data.totalPlatformViews / data.totalVideos).toLocaleString()
              ) : (
                0
              )}
            </p>
            <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <span>Audience engagement index per published video</span>
            </div>
          </div>
        </div>

        {/* Video Performance Table Section */}
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          {/* Header & Search */}
          <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Video Statistics & Views Performance
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Detailed views per video breakdown sorted by highest audience impact
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search track or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-600 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Track / Video</th>
                  <th className="py-3 px-4">Artist</th>
                  <th className="py-3 px-4 text-right">Views</th>
                  <th className="py-3 px-4">Access Type</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <div className="inline-flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading platform video analytics...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVideos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      {searchQuery ? 'No videos matching your search.' : 'No videos recorded on the platform yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredVideos.map((v, idx) => {
                    return (
                      <tr
                        key={v.id}
                        className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        {/* Rank */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-purple-400 text-black shadow-sm'
                                : idx === 1
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                                : idx === 2
                                ? 'bg-purple-700 text-white'
                                : 'text-gray-500 dark:text-gray-400 font-semibold'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Title & Thumbnail */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0">
                              {v.thumbnail_url ? (
                                <img
                                  src={v.thumbnail_url}
                                  alt={v.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
                                {v.title}
                              </p>
                              <span className="text-[10px] text-gray-400 font-mono">
                                ID: {v.id.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Artist */}
                        <td className="py-3 px-4 font-semibold text-gray-800 dark:text-gray-200">
                          {v.artist_name}
                        </td>

                        {/* Views */}
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-sm text-gray-900 dark:text-white">
                            {v.views.toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-gray-400">views</span>
                        </td>

                        {/* Access Type */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              v.is_free
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400'
                            }`}
                          >
                            {v.is_free ? 'Free Stream' : 'Pay-Per-View'}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 font-bold text-gray-700 dark:text-gray-300">
                          {v.is_free ? '0 RWF' : `${Number(v.price_rwf || 0).toLocaleString()} RWF`}
                        </td>

                        {/* Uploaded */}
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
