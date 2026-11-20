import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Globe,
  Flame,
  Music2,
  Radio,
  Star,
  BarChart3,
  Sparkles,
  Settings,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useArtistAuth } from '../contexts/ArtistAuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  user?: {
    full_name?: string;
    email?: string;
    username?: string;
  } | null;
}

export default function Sidebar({ mobile, collapsed = false, onClose, user: propUser }: SidebarProps) {
  const location = useLocation();
  const { user: authUser, roleData } = useAuth();
  const { artist } = useArtistAuth();

  const user = propUser || authUser;
  const isArtist = Boolean(artist || roleData?.role === 'artist' || roleData?.momo_code);

  const { data: artistsData } = useQuery({
    queryKey: ['artists', 'sidebar-follows'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/artists');
        return res.data;
      } catch {
        return { artists: [] };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  const rawList = Array.isArray(artistsData) ? artistsData : artistsData?.artists || [];
  const followedArtists = rawList.slice(0, 5).map((a: any) => {
    const rawName = a.full_name || a.artist_name || a.stage_name || a.name || 'Artist';
    return {
      id: String(a.id),
      name: rawName,
      verified: Boolean(a.is_verified || a.verification_status === 'verified'),
      avatar: a.avatar_url || a.profile_image || a.avatar_path || '',
    };
  });

  const isActive = (path: string) => {
    if (path === '/') {
      return (
        location.pathname === '/' &&
        !location.pathname.startsWith('/trending') &&
        !location.pathname.startsWith('/shorts') &&
        !location.pathname.startsWith('/music') &&
        !location.pathname.startsWith('/live') &&
        !location.pathname.startsWith('/follows')
      );
    }
    if (path === '/shorts') {
      return location.pathname.startsWith('/shorts');
    }
    if (path === '/music') {
      return location.pathname.startsWith('/music');
    }
    if (path === '/live') {
      return location.pathname.startsWith('/live');
    }
    if (path === '/follows') {
      return (
        location.pathname === '/follows' ||
        location.pathname === '/feed' ||
        location.pathname.startsWith('/dashboard/following')
      );
    }
    if (path === '/artist/dashboard' || path === '/artist/signup' || path === '/artist/login') {
      return location.pathname.startsWith('/artist');
    }
    if (path === '/settings') {
      return (
        location.pathname === '/settings' ||
        location.pathname === '/dashboard/settings'
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

  const userHandle =
    (user as any)?.user_metadata?.username ||
    (user as any)?.user_metadata?.full_name ||
    roleData?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Account');

  const studioItem = isArtist
    ? { label: 'Studio', path: '/artist/dashboard', icon: BarChart3 }
    : user
    ? { label: 'Become Artist', path: '/artist/signup', icon: Sparkles }
    : { label: 'Studio', path: '/artist/login', icon: BarChart3 };

  const navItems: Array<{
    label: string;
    path: string;
    icon: React.ComponentType<any>;
    hasFollowedList?: boolean;
  }> = [
    { label: 'Explore', path: '/', icon: Globe },
    { label: 'Shorts', path: '/shorts', icon: Flame },
    { label: 'Music', path: '/music', icon: Music2 },
    { label: 'Live', path: '/live', icon: Radio },
    { label: 'Following', path: '/follows', icon: Star, hasFollowedList: true },
    studioItem,
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const profileTarget = user ? (isArtist ? '/artist/dashboard' : '/dashboard') : '/auth';
  const profileActive = isArtist ? isActive('/artist/dashboard') : isActive('/dashboard');

  return (
    <aside
      id="paytune-sidebar"
      aria-label="Primary navigation"
      className={`${
        mobile
          ? 'flex w-full h-full'
          : `hidden md:flex ${collapsed ? 'w-16' : 'w-52'}`
      } bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-gray-800 flex-col py-3 ${
        collapsed && !mobile ? 'px-2' : 'px-2.5'
      } overflow-y-auto no-scrollbar transition-all duration-200 select-none flex-shrink-0 text-gray-900 dark:text-gray-100`}
    >
      {mobile && (
        <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-gray-100 dark:border-gray-800">
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white uppercase">
            PAYTUNE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          const isIconOnly = collapsed && !mobile;

          return (
            <div key={item.label + item.path}>
              <Link
                id={`sidebar-link-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                to={item.path}
                onClick={onClose}
                title={isIconOnly ? item.label : undefined}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center ${
                  isIconOnly ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'
                } rounded-xl transition-colors duration-150 ${
                  active
                    ? 'bg-[#F3E8FF] dark:bg-purple-600/20 text-[#7C3AED] dark:text-purple-400 font-bold'
                    : 'text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] flex-shrink-0 ${
                    active ? 'text-[#7C3AED] dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'
                  }`}
                  strokeWidth={2.1}
                />
                {!isIconOnly && (
                  <span className="text-[14px] leading-tight whitespace-nowrap truncate">
                    {item.label}
                  </span>
                )}
              </Link>

              {item.hasFollowedList && !isIconOnly && followedArtists.length > 0 && (
                <div className="ml-4 pl-3 border-l border-gray-200 dark:border-gray-800 my-1.5 space-y-1">
                  {followedArtists.map((a: any) => (
                    <Link
                      key={a.id}
                      to={`/artist/${a.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
                      title={a.name}
                    >
                      <div className="relative flex-shrink-0">
                        {a.avatar ? (
                          <img
                            src={a.avatar}
                            alt={a.name}
                            className="w-5 h-5 rounded-sm object-cover border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-sm bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 font-bold text-[10px] flex items-center justify-center border border-purple-200 dark:border-purple-600/30">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {a.verified && (
                          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#121212]">
                            <CheckCircle2 className="w-2 h-2" />
                          </span>
                        )}
                      </div>
                      <span className="whitespace-nowrap truncate text-[12px] font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#7C3AED] dark:group-hover:text-purple-400 transition-colors">
                        {a.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-1">
          <Link
            id="sidebar-link-profile"
            to={profileTarget}
            onClick={onClose}
            title={collapsed && !mobile ? (user ? userHandle : 'Sign In') : undefined}
            aria-label={user ? userHandle : 'Sign In'}
            className={`flex items-center ${
              collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
            } rounded-xl transition-colors duration-150 ${
              profileActive
                ? 'bg-[#F3E8FF] dark:bg-purple-600/20 text-[#7C3AED] dark:text-purple-400 font-bold'
                : 'text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white flex-shrink-0 overflow-hidden text-[11px] font-bold">
              {userHandle.charAt(0).toUpperCase()}
            </div>
            {!(collapsed && !mobile) && (
              <span className="text-[14px] leading-tight whitespace-nowrap truncate">
                {user ? userHandle : 'Sign In'}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {!(collapsed && !mobile) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2.5 px-2 text-xs">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-semibold text-gray-700 dark:text-gray-300">
            <Link to="/guides" onClick={onClose} className="hover:text-[#7C3AED] dark:hover:text-purple-400 transition-colors">
              Guides
            </Link>
            <Link to="/legal" onClick={onClose} className="hover:text-[#7C3AED] dark:hover:text-purple-400 transition-colors">
              Legal
            </Link>
            <Link to="/dmca" onClick={onClose} className="hover:text-[#7C3AED] dark:hover:text-purple-400 transition-colors">
              DMCA
            </Link>
          </div>

          <div className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <div>
              <Link to="/legal?tab=privacy" onClick={onClose} className="hover:text-[#7C3AED] dark:hover:text-purple-400 transition-colors">
                Privacy &amp; Cookies
              </Link>
            </div>
            <div>
              <Link to="/legal?tab=terms" onClick={onClose} className="hover:text-[#7C3AED] dark:hover:text-purple-400 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>

          <p className="pt-1 text-[11px] text-gray-400 dark:text-gray-500">
            © 2026 PAYTUNE
          </p>
        </div>
      )}
    </aside>
  );
}
