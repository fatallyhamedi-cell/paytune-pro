import { Outlet, Link, useLocation } from 'react-router-dom';
import { useArtistAuth } from '../contexts/ArtistAuthContext';

const tabs = [
  { path: '/artist/dashboard', label: 'Overview' },
  { path: '/artist/dashboard/videos', label: 'Releases & Catalog' },
  { path: '/artist/dashboard/upload', label: '+ Upload Media' },
  { path: '/artist/dashboard/analytics', label: 'Analytics' },
  { path: '/artist/dashboard/earnings', label: 'Earnings & MoMo' },
  { path: '/artist/dashboard/followers', label: 'Followers' },
  { path: '/artist/dashboard/live', label: 'Live Stream' },
  { path: '/artist/dashboard/membership', label: 'Memberships' },
  { path: '/artist/dashboard/profile', label: 'Profile & Branding' },
];

export default function ArtistDashboardLayout() {
  const { artist, logout } = useArtistAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#161616]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center font-bold text-black text-lg shadow-sm">
            {artist?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="font-semibold text-white">{artist?.full_name || 'Artist'}</p>
            <p className="text-xs text-gray-400">{artist?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-white/5 transition-colors"
          >
            ← View PAYTUNE
          </Link>
          <button
            onClick={logout}
            className="text-sm text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="flex gap-2 px-4 py-3 border-b border-gray-800 overflow-x-auto bg-[#141414]">
        {tabs.map((t) => {
          const active = location.pathname === t.path;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-amber-500 text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <main className="p-6 max-w-7xl mx-auto"><Outlet /></main>
    </div>
  );
}
