import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ArtistAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/artist/analytics')
      .then(r => setData(r.data))
      .catch(err => {
        console.error('Failed to load analytics:', err);
        setError(err.response?.data?.error || 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audience & Performance Analytics</h1>
        <p className="text-xs text-gray-400">Real-time engagement metrics across your catalog</p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="TOTAL VIDEO VIEWS" value={(data?.total_views || 0).toLocaleString()} />
        <Card label="ESTIMATED WATCH TIME" value={`${(data?.total_watch_minutes || 0).toLocaleString()} min`} />
        <Card label="AVG. VIEW DURATION" value={`${data?.average_view_duration || 0} sec`} />
      </div>

      <div className="bg-[#161616] p-6 rounded-2xl border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-white">Top Performing Videos</h2>
        {(data?.top_videos || []).length === 0 ? (
          <p className="text-gray-500 text-sm">No video performance data recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {data.top_videos.map((v: any, index: number) => (
              <div
                key={v.id || index}
                className="bg-[#202020] p-4 rounded-xl flex items-center justify-between border border-gray-800/80 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-white truncate">{v.title}</span>
                </div>
                <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 whitespace-nowrap">
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
    <div className="bg-[#161616] p-5 rounded-2xl border border-gray-800">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-white text-2xl font-black mt-2">{value}</p>
    </div>
  );
}
