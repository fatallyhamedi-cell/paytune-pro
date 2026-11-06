import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Video, DollarSign, TrendingUp, Plus, RefreshCw, Film } from 'lucide-react';

export default function ArtistDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('artist_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/artist/dashboard', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load dashboard: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Failed to load artist dashboard:', err);
      setError(err.message || 'Failed to load artist dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalViews = data?.totalViews ?? data?.stats?.total_views ?? 0;
  const totalVideos = data?.totalVideos ?? data?.stats?.total_videos ?? data?.videos?.length ?? 0;
  const balance = data?.balance ?? data?.stats?.current_balance ?? 0;
  const currency = data?.artist?.currency_code || 'RWF';
  const videos = data?.videos || [];

  return (
    <div className="space-y-8 bg-gray-50 dark:bg-[#0F0F0F] min-h-screen text-gray-900 dark:text-gray-100 p-4 sm:p-6 transition-colors duration-200">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#161616] rounded-2xl p-6 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-black font-black text-2xl shadow-md">
            {data?.artist?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                {data?.artist?.full_name || 'Creator Studio'}
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                ✓ Verified Artist
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {data?.artist?.email || 'artist@paytune.com'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              MoMo: {data?.artist?.momo_code || 'Configured'} ({data?.artist?.momo_provider || 'MTN'}) • Revenue Split: 70% Creator / 30% Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/artist/dashboard/upload"
            className="bg-purple-600 hover:bg-purple-400 text-neutral-950 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Upload New Video
          </Link>
          <button
            onClick={loadDashboardData}
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Video Analytics KPI Cards: Total Video Views, Uploaded Videos, Available Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Total Video Views */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-purple-600/30 dark:border-purple-600/30 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Total Video Views
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-600/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-600/20">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            {loading ? (
              <span className="inline-block w-24 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
            ) : (
              Number(totalViews).toLocaleString()
            )}
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
            <span>Cumulative audience streams across your entire catalog</span>
          </div>
        </div>

        {/* 2. Uploaded Videos */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Uploaded Videos
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
              <Video className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            {loading ? (
              <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
            ) : (
              Number(totalVideos).toLocaleString()
            )}
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Film className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
            <span>Published songs and video tracks live on PAYTUNE</span>
          </div>
        </div>

        {/* 3. Available Balance */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Available Balance
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            {loading ? (
              <span className="inline-block w-28 h-8 bg-gray-200 dark:bg-neutral-800 animate-pulse rounded" />
            ) : (
              `${Number(balance).toLocaleString()} ${currency}`
            )}
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Link to="/artist/dashboard/earnings" className="text-purple-600 hover:underline font-semibold">
              Withdraw via MTN MoMo →
            </Link>
          </div>
        </div>
      </div>

      {/* Your Video Performance Table */}
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              Your Video Performance
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Real-time views and earnings per uploaded music video
            </p>
          </div>
          <Link
            to="/artist/dashboard/videos"
            className="text-xs text-purple-700 dark:text-purple-400 hover:underline font-bold"
          >
            Manage Tracks ({videos.length}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Track Title</th>
                <th className="py-3 px-4 text-right">Views</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Monetization</th>
                <th className="py-3 px-4">Upload Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="inline-flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading your video performance...</span>
                    </div>
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <p className="font-semibold text-gray-600 dark:text-gray-300 mb-2">No videos uploaded yet</p>
                    <Link
                      to="/artist/dashboard/upload"
                      className="inline-block bg-purple-600 text-black px-4 py-2 rounded-xl font-bold text-xs shadow-md"
                    >
                      Upload Your First Track
                    </Link>
                  </td>
                </tr>
              ) : (
                videos.map((v: any, idx: number) => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-gray-500 dark:text-gray-400">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-14 h-9 rounded-lg overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0">
                          {v.thumbnail_url ? (
                            <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
                          {v.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-black text-sm text-gray-900 dark:text-white">
                        {Number(v.views || 0).toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-gray-400">views</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-700 dark:text-gray-300">
                      {v.is_free ? '0 RWF' : `${Number(v.price_rwf || 0).toLocaleString()} RWF`}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          v.is_free
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400'
                        }`}
                      >
                        {v.is_free ? 'Free' : 'Pay-Per-View'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : 'Recent'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
