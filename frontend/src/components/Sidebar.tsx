import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Globe,
  Compass,
  Flame,
  PlaySquare,
  Star,
  BarChart3,
  Settings,
  UserCircle2,
  CheckCircle2,
  X
} from 'lucide-react';
interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  user?: {
    full_name?: string;
    email?: string;
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

  // Followed artists under Follows navigation item
  const [followedArtists] = useState([
    {
      id: '1',
      name: 'MyFrenchFilmFestival',
      verified: true,
      avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80',
    },
  ]);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' && !location.search.includes('sort=');
    }
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const profileLabel = user?.full_name || 'Profile';

  const navItems = [
    { label: 'Explore', path: '/', icon: Globe },
    { label: 'Trending', path: '/trending', icon: Flame },
    { label: 'Shorts', path: '/shorts', icon: PlaySquare },
    { label: 'Following', path: '/follows', icon: Star, hasFollowedList: true },
    { label: 'Studio', path: '/artist/dashboard', icon: BarChart3 },
    { label: 'Settings', path: '/dashboard/settings', icon: Settings },
    { label: profileLabel, path: '/dashboard', icon: UserCircle2, isProfile: true },
  ];

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

      {/* Main Navigation */}
      <nav className="space-y-1">
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
                    ? 'bg-[#F3E8FF] text-[#8B5CF6] font-semibold'
                    : 'text-gray-900 font-semibold hover:bg-gray-100'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active ? 'text-[#8B5CF6]' : 'text-gray-900'
                  }`}
                />
                {!collapsed && (
                  <span className="text-[14px] truncate">{item.label}</span>
                )}
              </Link>

              {/* Sub-section for Follows (followed artists list) */}
              {item.hasFollowedList && !collapsed && (
                <div className="ml-6 pl-4 border-l border-gray-200 my-1.5 space-y-2">
                  {followedArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      to={`/artist/${artist.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 py-1 cursor-pointer group"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={artist.avatar}
                          alt={artist.name}
                          className="w-6 h-6 rounded-full object-cover border border-gray-200"
                        />
                        {artist.verified && (
                          <CheckCircle2 className="w-3 h-3 absolute -bottom-1 -right-1 text-black fill-white" />
                        )}
                      </div>
                      <span className="text-xs text-gray-700 truncate group-hover:text-[#8B5CF6] font-medium">
                        {artist.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Links */}
      {!collapsed && (
        <div className="mt-8 pt-4 border-t border-gray-100 space-y-3 px-3 text-[13px]">
          <div className="space-y-2 font-bold text-gray-900">
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
              <span className="text-gray-900">Legal</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-gray-500 font-normal">
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
              <Link to="/videos" className="hover:text-[#8B5CF6] transition-colors">
                All videos
              </Link>
            </div>
          </div>

          <p className="pt-4 text-xs text-gray-400">© 2026 PayTune</p>
        </div>
      )}
    </aside>
  );
}
