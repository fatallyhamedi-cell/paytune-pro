import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Globe,
  Music2,
  Star,
  BarChart3,
  Settings,
  CheckCircle2,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  user?: {
    full_name?: string;
    email?: string;
    username?: string;
  } | null;
}

export default function Sidebar({ mobile, collapsed, onClose, user: propUser }: SidebarProps) {
  const location = useLocation();

  const user = propUser || (() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const followedArtists = [
    {
      id: '1',
      name: 'MyFrenchFilmFestival',
      display_name: 'MyFrenchFilmFesti...',
      verified: true,
      avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=120&auto=format&fit=crop&q=80',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return (
        location.pathname === '/' &&
        !location.pathname.startsWith('/music') &&
        !location.pathname.startsWith('/trending') &&
        !location.pathname.startsWith('/shorts') &&
        !location.pathname.startsWith('/follows')
      );
    }
    if (path === '/music') {
      return location.pathname.startsWith('/music');
    }
    if (path === '/follows') {
      return (
        location.pathname === '/follows' ||
        location.pathname === '/feed' ||
        location.pathname.startsWith('/dashboard/following')
      );
    }
    if (path === '/artist/dashboard') {
      return location.pathname.startsWith('/artist');
    }
    if (path === '/settings') {
      return location.pathname === '/settings' || location.pathname.startsWith('/dashboard/settings');
    }
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const userHandle = user?.username || user?.full_name || (user?.email ? user.email.split('@')[0] : 'fatal_mbz67');

  const navItems = [
    { label: 'Explore', path: '/', icon: Globe },
    { label: 'Music', path: '/music', icon: Music2 },
    { label: 'Following', path: '/follows', icon: Star, hasFollowedList: true },
    { label: 'Studio', path: '/artist/dashboard', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const profileActive = isActive('/dashboard');

  return (
    <aside
      className={`${
        mobile ? 'flex w-full h-full' : 'w-64 hidden md:flex'
      } bg-white flex-col py-4 px-3 overflow-y-auto border-r border-gray-200 select-none text-gray-900 transition-colors`}
    >
      {mobile && (
        <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-gray-100">
          <span className="font-bold text-sm tracking-tight uppercase text-gray-900">
            PayTune
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Navigation Stack */}
      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <div key={item.label + item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-150 ${
                  active
                    ? 'bg-[#F3E8FF] text-[#8B5CF6] font-bold'
                    : 'text-gray-900 font-bold hover:bg-gray-100'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active ? 'text-[#8B5CF6]' : 'text-gray-900'
                  }`}
                  strokeWidth={2.2}
                />
                {!collapsed && (
                  <span className="text-[15px] tracking-tight truncate">{item.label}</span>
                )}
              </Link>

              {/* Sub-section for Followed Artists List */}
              {item.hasFollowedList && !collapsed && (
                <div className="ml-6 pl-4 border-l border-gray-200 my-1.5 space-y-2">
                  {followedArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      to={`/artist/${artist.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
                      title={artist.name}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={artist.avatar}
                          alt={artist.name}
                          className="w-6 h-6 rounded-sm object-cover border border-gray-200"
                        />
                        {artist.verified && (
                          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-black text-white rounded-full flex items-center justify-center ring-1 ring-white">
                            <CheckCircle2 className="w-2.5 h-2.5 fill-black text-white" />
                          </span>
                        )}
                      </div>
                      <span className="text-[13px] text-gray-800 truncate group-hover:text-[#8B5CF6] font-semibold transition-colors">
                        {artist.display_name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* User Profile Navigation Row */}
        <div>
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-150 ${
              profileActive
                ? 'bg-[#F3E8FF] text-[#8B5CF6] font-bold'
                : 'text-gray-900 font-bold hover:bg-gray-100'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white flex-shrink-0 overflow-hidden shadow-xs">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-current"
                fill="none"
              >
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path
                  d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
                  fill="currentColor"
                />
              </svg>
            </div>
            {!collapsed && (
              <span className="text-[15px] tracking-tight truncate">
                {userHandle}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {/* Footer Navigation Links matching Dailymotion screenshot layout */}
      {!collapsed && (
        <div className="mt-6 pt-5 border-t border-gray-100 space-y-3 px-2 text-[13px]">
          <div className="space-y-1.5 font-bold text-gray-900">
            <div>
              <Link to="/about" className="hover:text-[#8B5CF6] transition-colors">
                Company
              </Link>
            </div>
            <div>
              <Link to="/support" className="hover:text-[#8B5CF6] transition-colors">
                Support
              </Link>
            </div>
            <div>
              <Link to="/legal" className="hover:text-[#8B5CF6] transition-colors">
                Legal
              </Link>
            </div>
          </div>

          <div className="space-y-1 text-xs text-gray-500 font-normal">
            <div>
              <Link to="/privacy" className="hover:text-[#8B5CF6] transition-colors">
                Privacy and Cookie Policy
              </Link>
            </div>
            <div>
              <Link to="/legal" className="hover:text-[#8B5CF6] transition-colors">
                Legal notices
              </Link>
            </div>
            <div>
              <Link to="/terms" className="hover:text-[#8B5CF6] transition-colors">
                Terms
              </Link>
            </div>
            <div>
              <Link to="/" className="hover:text-[#8B5CF6] transition-colors">
                All videos
              </Link>
            </div>
          </div>

          <p className="pt-3 text-xs text-gray-400 font-normal">© 2026 Dailymotion</p>
        </div>
      )}
    </aside>
  );
}
