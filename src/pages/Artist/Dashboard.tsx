import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';
import api from '../../services/api';

export default function ArtistDashboard() {
  const { artist, refreshArtist } = useArtistAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshArtist();
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/artist/dashboard');
        setData(res.data);
      } catch (err: any) {
        console.error('Failed to load dashboard:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (artist) {
      loadDashboardData();
    }
  }, [artist?.id]);

  if (!artist) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
        Loading artist profile...
      </div>
    );
  }

  const isApproved = artist.is_approved || data?.artist?.is_approved;
  const approvalStatus = data?.artist?.approval_status || artist.approval_status || 'pending';

  return (
    <div className="space-y-6">
      {/* Artist Profile Banner Header */}
      <div className="bg-[#161616] rounded-2xl p-6 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-2xl shadow-lg">
            {artist.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{artist.full_name}</h1>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  isApproved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : approvalStatus === 'rejected'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {isApproved ? '✓ Verified & Approved' : `Status: ${approvalStatus.toUpperCase()}`}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{artist.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              MoMo Account: {artist.momo_code || 'Not set'} ({artist.momo_provider || 'MTN'}) • Currency: {artist.currency_code || 'RWF'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/artist/dashboard/upload"
            className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <span>+</span> Upload Video
          </Link>
          <Link
            to="/artist/dashboard/earnings"
            className="bg-[#262626] hover:bg-[#333] text-white px-4 py-2.5 rounded-xl font-semibold text-sm border border-gray-700 transition-all"
          >
            Withdraw MoMo
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />
          Loading your artist dashboard...
        </div>
      ) : data ? (
        <>
          {/* Revenue & Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="TOTAL REVENUE EARNED"
              value={`${Number(data.stats.total_earnings || 0).toLocaleString()} ${artist.currency_code || 'RWF'}`}
              sub="Direct pay-per-view video purchases"
              highlight
            />
            <StatCard
              label="AVAILABLE BALANCE"
              value={`${Number(data.stats.current_balance || 0).toLocaleString()} ${artist.currency_code || 'RWF'}`}
              sub="Ready for instant MoMo withdrawal"
            />
            <StatCard
              label="PENDING WITHDRAWALS"
              value={`${Number(data.stats.pending_balance || 0).toLocaleString()} ${artist.currency_code || 'RWF'}`}
              sub="Currently processing to telecom network"
            />
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Videos"
              value={data.stats.total_videos || 0}
              sub="Published on PAYTUNE"
            />
            <StatCard
              label="Total Views"
              value={(data.stats.total_views || 0).toLocaleString()}
              sub="Across all tracks"
            />
            <StatCard
              label="Followers"
              value={(data.stats.total_followers || 0).toLocaleString()}
              sub="Subscribed fans"
            />
            <StatCard
              label="Paid Purchases"
              value={(data.stats.total_purchases || 0).toLocaleString()}
              sub="Completed unlock orders"
            />
          </div>

          {/* Video Catalog */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Your Uploaded Tracks & Videos</h2>
              <Link
                to="/artist/dashboard/videos"
                className="text-xs text-amber-500 hover:underline font-semibold"
              >
                View all ({data.videos.length}) →
              </Link>
            </div>

            {data.videos.length === 0 ? (
              <div className="bg-[#161616] rounded-2xl p-12 text-center border border-gray-800">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-2xl mx-auto mb-3">
                  🎬
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No videos uploaded yet</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                  Start monetizing your music! Upload your music videos, set your own pay-per-view price in RWF/USD, and earn from every view.
                </p>
                <Link
                  to="/artist/dashboard/upload"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2.5 rounded-xl text-sm inline-block shadow-md transition-all"
                >
                  Upload Your First Video
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.videos.map((v: any) => (
                  <div
                    key={v.id}
                    className="bg-[#161616] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all group"
                  >
                    <div className="relative aspect-video bg-[#242424] overflow-hidden">
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          No Thumbnail
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                        {v.is_free ? 'FREE' : `${Number(v.price_rwf || 0).toLocaleString()} RWF`}
                      </div>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <p className="font-semibold text-white truncate text-sm" title={v.title}>
                        {v.title}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>👁️ {(v.views || 0).toLocaleString()} views</span>
                        <span>{v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: any;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border transition-all ${
        highlight
          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 shadow-lg'
          : 'bg-[#161616] border-gray-800'
      }`}
    >
      <p className="text-gray-400 text-xs font-semibold tracking-wider uppercase">{label}</p>
      <p className={`text-2xl md:text-3xl font-black mt-2 ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
