import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ArtistAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/artist/analytics')
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error('Failed to load analytics:', err);
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 dark:text-gray-400">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3" />
        Loading analytics...
      </div>
    );
  }

  const totalViews = data?.total_views ?? data?.summary?.total_views ?? 0;
  const totalWatchMinutes = data?.total_watch_minutes ?? data?.summary?.total_watch_time_minutes ?? 0;
  const avgDuration = data?.average_view_duration ?? data?.summary?.avg_view_duration ?? 0;
  const topVideos = data?.top_videos ?? data?.top_performing_videos ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audience & Performance Analytics</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">Real-time engagement metrics across your catalog</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="TOTAL VIDEO VIEWS" value={Number(totalViews).toLocaleString()} />
        <Card label="ESTIMATED WATCH TIME" value={`${Number(totalWatchMinutes).toLocaleString()} min`} />
        <Card label="AVG. VIEW DURATION" value={typeof avgDuration === 'number' ? `${avgDuration} sec` : avgDuration} />
      </div>

      <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Performing Videos</h2>
        {topVideos.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No video performance data recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {topVideos.map((v: any, index: number) => (
              <div
                key={v.id || index}
                className="bg-gray-50 dark:bg-[#202020] p-4 rounded-xl flex items-center justify-between border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.title}</span>
                </div>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-600/10 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-600/20 whitespace-nowrap">
                  {(v.views || 0).toLocaleString()} views
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white dark:bg-[#161616] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-gray-900 dark:text-white text-2xl font-black mt-2">{value}</p>
    </div>
  );
}
