import { Outlet, Link, useLocation } from 'react-router-dom';
import { useArtistAuth } from '../contexts/ArtistAuthContext';

const tabs = [
  { path: '/artist/dashboard', label: 'Overview' },
  { path: '/artist/dashboard/videos', label: 'Releases & Catalog' },
  { path: '/artist/dashboard/upload', label: '+ Upload Media' },
  { path: '/artist/dashboard/analytics', label: 'Analytics' },
  { path: '/artist/dashboard/earnings', label: 'Earnings & MoMo' },
  { path: '/artist/dashboard/monetization', label: 'Monetization & Ads' },
  { path: '/artist/dashboard/followers', label: 'Followers' },
  { path: '/artist/dashboard/live', label: 'Live Stream' },
  { path: '/artist/dashboard/membership', label: 'Memberships' },
  { path: '/artist/dashboard/profile', label: 'Profile & Branding' },
];

export default function ArtistDashboardLayout() {
  const { artist, logout } = useArtistAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center font-bold text-white text-lg shadow-sm">
            {artist?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{artist?.full_name || 'Artist'}</p>
            <p className="text-xs text-gray-500">{artist?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            ← View PAYTUNE
          </Link>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto bg-white scrollbar-hide">
        {tabs.map((t) => {
          const active = location.pathname === t.path;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-[#F3E8FF] text-[#8B5CF6] font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
