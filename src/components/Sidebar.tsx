import React, { useState, useEffect } from 'react';
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
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ mobile, collapsed, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, roleData } = useAuth();

  // Fetch artists or fallback to default sample list
  const { data: artistsData } = useQuery({
    queryKey: ['artists', 'sidebar-follows'],
    queryFn: async () => {
      try {
        const res = await api.get('/artists');
        return res.data;
      } catch {
        return { artists: [] };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  const [followedArtists, setFollowedArtists] = useState([
    {
      id: '1',
      name: 'MyFrenchFilmFestival',
      verified: true,
      avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80',
    },
  ]);

  useEffect(() => {
    const rawList = Array.isArray(artistsData)
      ? artistsData
      : artistsData?.artists || [];
    if (rawList.length > 0) {
      setFollowedArtists(
        rawList.slice(0, 3).map((a: any) => ({
          id: String(a.id),
          name: a.full_name || a.name || 'Artist',
          verified: true,
          avatar:
            a.avatar_url ||
            a.profile_image ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              a.full_name || a.name || 'A'
            )}&background=111&color=fff&size=64`,
        }))
      );
    }
  }, [artistsData]);

  const isActive = (path: string) => {
    if (path === '/') {
      return (
        location.pathname === '/' &&
        !location.search.includes('sort=') &&
        !location.pathname.startsWith('/trending') &&
        !location.pathname.startsWith('/shorts') &&
        !location.pathname.startsWith('/follows')
      );
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
    if (path === '/dashboard/settings') {
      return (
        location.pathname === '/dashboard/settings' ||
        location.pathname === '/settings'
      );
    }
    if (path === '/dashboard') {
      return (
        location.pathname === '/dashboard' ||
        location.pathname.startsWith('/dashboard/purchased') ||
        location.pathname.startsWith('/dashboard/history')
      );
    }
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const profileLabel =
    (user as any)?.full_name ||
    user?.user_metadata?.full_name ||
    roleData?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Profile');

  const navItems = [
    { label: 'Explore', path: '/', icon: Globe },
    { label: 'Trending', path: '/trending', icon: Flame },
    { label: 'Shorts', path: '/shorts', icon: PlaySquare },
    { label: 'Following', path: '/follows', icon: Star, hasFollowedList: true },
    { label: 'Studio', path: '/artist/dashboard', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: profileLabel, path: '/dashboard', icon: UserCircle2, isProfile: true },
  ];

  return (
    <aside
      id="paytune-sidebar"
      className={`${
        mobile
          ? 'flex w-full h-full'
          : `hidden md:flex ${collapsed ? 'w-20' : 'w-64'}`
      } bg-white border-r border-gray-200 flex-col py-4 px-3 overflow-y-auto no-scrollbar transition-all duration-200 select-none flex-shrink-0 text-gray-900`}
    >
      {/* Mobile Drawer Close Header */}
      {mobile && (
        <div className="flex items-center justify-between px-2 pb-4 mb-2 border-b border-gray-100">
          <span className="font-bold text-sm tracking-tight text-gray-900 uppercase">
            PayTune
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Navigation Stack */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <div key={item.label + item.path}>
              <Link
                id={`sidebar-link-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
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
                      className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={artist.avatar}
                          alt={artist.name}
                          className="w-6 h-6 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://ui-avatars.com/api/?name=FR&background=111&color=fff';
                          }}
                        />
                        {artist.verified && (
                          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-black text-white rounded-full flex items-center justify-center ring-1 ring-white">
                            <CheckCircle2 className="w-2.5 h-2.5 fill-black text-white" />
                          </span>
                        )}
                      </div>
                      <span className="truncate text-xs font-medium text-gray-700 group-hover:text-[#8B5CF6]">
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

      {/* Footer Navigation Links */}
      {!collapsed && (
        <div className="mt-8 pt-4 border-t border-gray-100 space-y-3 px-3 text-[13px]">
          <div className="space-y-2 font-bold text-gray-900">
            <div>
              <Link
                to="/guides"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                Company
              </Link>
            </div>
            <div>
              <Link
                to="/guides"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                Support
              </Link>
            </div>
            <div>
              <span className="text-gray-900">Legal</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-gray-500 font-normal">
            <div>
              <Link
                to="/legal?tab=privacy"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                Privacy and Cookie Policy
              </Link>
            </div>
            <div>
              <Link
                to="/legal?tab=notices"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                Legal notices
              </Link>
            </div>
            <div>
              <Link
                to="/legal?tab=terms"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                Terms
              </Link>
            </div>
            <div>
              <Link
                to="/"
                onClick={onClose}
                className="hover:text-[#8B5CF6] transition-colors"
              >
                All videos
              </Link>
            </div>
          </div>

          <p className="pt-4 text-xs text-gray-400 font-normal">
            © 2026 PayTune
          </p>
        </div>
      )}
    </aside>
  );
}
