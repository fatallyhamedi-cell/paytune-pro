import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  TrendingUp,
  Users,
  Library,
  History,
  ListMusic,
  LayoutDashboard,
  X,
  Radio,
  Film,
  CheckCircle,
  Clock,
  ThumbsUp,
  Music
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Logo from "./Logo";

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ mobile, collapsed, onClose }: SidebarProps) {
  const location = useLocation();
  const { roleData, user } = useAuth();
  const [followingArtists, setFollowingArtists] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      api.get('/api/user/following/artists')
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setFollowingArtists(res.data.map((a: any) => ({
              id: a.id,
              name: a.name || a.full_name,
              avatar: a.avatar || a.avatar_url || a.profile_image || '',
              live: !!a.live
            })));
          } else {
            // Fetch public artists from real database
            api.get('/api/artists')
              .then(aRes => {
                const list = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.artists || []);
                setFollowingArtists(list.slice(0, 5).map((a: any) => ({
                  id: a.id,
                  name: a.full_name || a.name,
                  avatar: a.avatar_url || a.profile_image || '',
                  live: false
                })));
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          // Public artists fallback from real DB
          api.get('/api/artists')
            .then(aRes => {
              const list = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.artists || []);
              setFollowingArtists(list.slice(0, 5).map((a: any) => ({
                id: a.id,
                name: a.full_name || a.name,
                avatar: a.avatar_url || a.profile_image || '',
                live: false
              })));
            })
            .catch(() => {});
        });
    } else {
      api.get('/api/artists')
        .then(aRes => {
          const list = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.artists || []);
          setFollowingArtists(list.slice(0, 5).map((a: any) => ({
            id: a.id,
            name: a.full_name || a.name,
            avatar: a.avatar_url || a.profile_image || '',
            live: false
          })));
        })
        .catch(() => {});
    }
  }, [user]);

  const isArtist = Boolean(roleData?.momo_code || roleData?.role === "artist");

  const mainLinks = [
    { icon: Home, label: "Home", path: "/" },
    { icon: TrendingUp, label: "Trending", path: "/?sort=most_purchased" },
    { icon: Film, label: "Shorts", path: "/shorts" },
    { icon: Users, label: "Following", path: "/dashboard/following", protected: true },
    { icon: Library, label: "Library", path: "/dashboard", protected: true },
    { icon: History, label: "History", path: "/dashboard/history", protected: true },
    { icon: ListMusic, label: "Playlists", path: "/dashboard/purchased", protected: true },
  ];

  if (isArtist) {
    mainLinks.push({
      icon: LayoutDashboard,
      label: "Artist Dashboard",
      path: "/artist/dashboard",
      protected: true
    });
  }

  const isLinkActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/" && !location.search.includes("sort=");
    }
    if (path.includes("?sort=")) {
      return location.search.includes("sort=most_purchased");
    }
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ item }: { item: any }) => {
    const active = isLinkActive(item.path);
    const isShorts = item.label === "Shorts";

    return (
      <Link
        id={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-150 group border-l-[3px] ${
          active
            ? "bg-amber-500/10 text-amber-500 border-amber-500 font-bold"
            : isShorts
            ? "border-transparent text-red-500 hover:bg-red-500/10 font-semibold"
            : "border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
        }`}
        title={item.label}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105 ${
            active 
              ? "text-amber-500" 
              : isShorts 
              ? "text-red-500" 
              : "text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200"
          }`}
        />
        {!collapsed && (
          <span className="text-[13px] tracking-tight truncate font-medium">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      id="paytune-sidebar"
      className={`${
        mobile ? "flex w-full h-full" : `hidden md:flex ${collapsed ? "w-20" : "w-60"}`
      } bg-white dark:bg-[#0F0F0F] border-r border-gray-200 dark:border-gray-800 flex-col py-3 px-2.5 overflow-y-auto no-scrollbar transition-all duration-200 select-none flex-shrink-0 text-gray-900 dark:text-white`}
    >
      {/* Mobile Header in Drawer */}
      {mobile && (
        <div className="flex items-center justify-between px-2 mb-4">
          <Logo />
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full text-gray-500 hover:text-black dark:hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Primary Links */}
      <nav className="space-y-1">
        {mainLinks.map((item) => (
          <NavItem key={item.label} item={item} />
        ))}
      </nav>

      <div className="h-px bg-gray-200 dark:bg-gray-800 my-3 mx-2" />

      {/* Following List (Followed Artists Avatars) */}
      {!collapsed && (
        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-between px-3 py-1">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Following
            </h4>
          </div>

          {followingArtists.map((artist) => (
            <Link
              key={artist.id}
              to={`/artist/${artist.id}`}
              onClick={onClose}
              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group"
            >
              <div className="flex items-center gap-3 truncate">
                <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-300 dark:ring-gray-700 bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
                  {artist.avatar ? (
                    <img
                      src={artist.avatar}
                      className="w-full h-full object-cover"
                      alt={artist.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-amber-500">
                      {artist.name ? artist.name.charAt(0).toUpperCase() : 'A'}
                    </span>
                  )}
                  {artist.live && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white dark:ring-[#0F0F0F]" />
                  )}
                </div>
                <span className="text-[13px] text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white truncate font-medium">
                  {artist.name}
                </span>
              </div>
              {artist.live && (
                <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Support Card */}
      {!collapsed && (
        <div className="mt-auto p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left relative overflow-hidden">
          <p className="text-[11px] font-black uppercase text-amber-500 tracking-wider">
            Direct Creator Support
          </p>
          <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium mt-1 leading-relaxed">
            One-time instant Mobile Money support directly to artists. 70/30 split.
          </p>
          <Link
            to="/guides"
            className="mt-2.5 inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline uppercase tracking-wide"
          >
            How it works →
          </Link>
        </div>
      )}

      {/* Footer info */}
      {!collapsed && (
        <div className="mt-4 px-2 text-[10px] text-gray-400 space-y-1">
          <div className="flex flex-wrap gap-2">
            <Link to="/guides?category=user" className="hover:underline hover:text-gray-600 dark:hover:text-gray-300">Guide</Link>
            <Link to="/legal?tab=terms" className="hover:underline hover:text-gray-600 dark:hover:text-gray-300">Terms</Link>
            <Link to="/legal?tab=privacy" className="hover:underline hover:text-gray-600 dark:hover:text-gray-300">Privacy</Link>
            <Link to="/dmca" className="hover:underline text-amber-500 font-semibold">DMCA</Link>
            <Link to="/copyright-portal" className="hover:underline text-amber-500 font-semibold">Rights Hub</Link>
          </div>
          <p className="pt-1">© 2026 PAYTUNE Inc.</p>
        </div>
      )}
    </aside>
  );
}
