import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  Video,
  Radio,
  LayoutDashboard,
  Music,
  Settings,
  LogOut,
  X,
  Flame,
  CheckCircle,
  ExternalLink,
  ArrowLeft,
  Globe,
  User
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import Logo from "./Logo";
import { NotificationsBell } from "./dashboard/NotificationsBell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  onMenuClick?: () => void;
}

interface Suggestion {
  id: string;
  title: string;
  artist_name?: string;
  type: "video" | "artist";
  artist_id?: string;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut, roleData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentCountry, countries, setCountryByCode } = useCurrency();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const isArtist = Boolean(roleData?.momo_code || roleData?.role === "artist");

  // Auto-suggest logic with debouncing
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/videos?q=${encodeURIComponent(searchQuery.trim())}&limit=6`);
        const videos = Array.isArray(res.data) ? res.data : (res.data.videos || []);
        
        const list: Suggestion[] = [];
        const seenArtists = new Set<string>();

        videos.forEach((v: any) => {
          list.push({
            id: String(v.id),
            title: v.title,
            artist_name: v.artist_name || v.artists?.full_name,
            type: "video",
            artist_id: String(v.artist_id || v.artists?.id)
          });

          const artistName = v.artist_name || v.artists?.full_name;
          if (artistName && !seenArtists.has(artistName.toLowerCase())) {
            seenArtists.add(artistName.toLowerCase());
            list.push({
              id: `artist-${v.artist_id || 1}`,
              title: artistName,
              artist_name: "Verified Channel",
              type: "artist",
              artist_id: String(v.artist_id || 1)
            });
          }
        });

        setSuggestions(list.slice(0, 6));
      } catch (err) {
        // quiet fallback
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const selectSuggestion = (s: Suggestion) => {
    setShowSuggestions(false);
    if (s.type === "artist" && s.artist_id) {
      navigate(`/artist/${s.artist_id}`);
    } else {
      navigate(`/watch/${s.id}`);
    }
  };

  return (
    <header
      id="paytune-header"
      className="fixed top-0 left-0 right-0 h-14 bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md flex items-center justify-between px-3 md:px-5 z-50 border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors duration-200 text-gray-900 dark:text-white"
    >
      {/* Mobile Active Search Bar (Full Header takeover) */}
      {mobileSearchOpen ? (
        <div className="flex md:hidden items-center w-full gap-2 relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-full flex-shrink-0"
            onClick={() => {
              setMobileSearchOpen(false);
              setShowSuggestions(false);
            }}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <form onSubmit={(e) => {
            handleSearchSubmit(e);
            setMobileSearchOpen(false);
          }} className="flex-1 flex items-center relative">
            <div className="flex flex-1 items-center bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-1.5 focus-within:border-amber-500">
              <input
                type="text"
                autoFocus
                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white font-medium"
                placeholder="Search music, songs, or artists..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="p-2 ml-1 text-gray-600 dark:text-gray-300 hover:text-amber-500 cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Mobile Auto-Suggest Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#181818] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5">
              {suggestions.map((s) => (
                <button
                  key={`mobile-${s.type}-${s.id}`}
                  onClick={() => {
                    selectSuggestion(s);
                    setMobileSearchOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between text-sm group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {s.type === "artist" ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        A
                      </div>
                    ) : (
                      <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-gray-900 dark:text-white truncate">
                      {s.title}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-amber-500 px-1.5 py-0.5 rounded bg-amber-500/10">
                    {s.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Left: Hamburger & Logo */}
          <div className="flex items-center gap-2">
            <Button
              id="header-hamburger-btn"
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-full h-9 w-9"
              onClick={onMenuClick}
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Logo />
          </div>

          {/* Center: Search Bar with Auto-Suggest (Desktop) */}
          <div
            ref={searchContainerRef}
            className="hidden md:flex flex-1 max-w-[540px] px-6 relative"
          >
            <form onSubmit={handleSearchSubmit} className="flex w-full relative">
              <div className="flex flex-1 items-center bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 focus-within:border-amber-500 overflow-hidden transition-all duration-200">
                <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                <input
                  id="desktop-search-input"
                  type="text"
                  className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Auto-Suggest Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-6 right-6 top-full mt-1.5 bg-white dark:bg-[#181818] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 animate-in fade-in-50 duration-150">
                {suggestions.map((s) => (
                  <button
                    key={`${s.type}-${s.id}`}
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between text-sm group transition-colors"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {s.type === "artist" ? (
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          A
                        </div>
                      ) : (
                        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-500 transition-colors">
                          {s.title}
                        </span>
                        {s.artist_name && (
                          <span className="ml-2 text-xs text-gray-400">
                            • {s.artist_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 px-2 py-0.5 rounded bg-amber-500/10">
                      {s.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Controls: Subscribe Pill, Notifications, User */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setMobileSearchOpen(true);
                setShowSuggestions(false);
              }}
              className="md:hidden hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded-full h-9 w-9"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* Currency Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white px-2.5 h-8 rounded-full border border-gray-200 dark:border-gray-800"
                >
                  <span className="text-sm">{currentCountry?.flag_emoji || "🇷🇼"}</span>
                  <span className="font-mono text-[11px]">{currentCountry?.currency_code || "RWF"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-white dark:bg-[#181818] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white p-1 rounded-2xl shadow-xl max-h-64 overflow-y-auto"
              >
                {countries.map((c) => (
                  <DropdownMenuItem
                    key={c.iso2}
                    onClick={() => setCountryByCode(c.iso2)}
                    className="cursor-pointer rounded-xl py-2 px-2.5 text-xs flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{c.flag_emoji}</span>
                      <span>{c.name}</span>
                    </span>
                    <span className="font-mono font-bold text-amber-500">{c.currency_code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full h-8 w-8"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-gray-700" />
              )}
            </Button>

            {/* Create Button (Visible only to Artists) */}
            {isArtist && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="header-create-btn"
                    className="bg-[#FFB300] hover:bg-amber-500 text-black font-extrabold text-xs uppercase tracking-tight rounded-full px-3.5 h-9 hidden sm:flex border-none shadow-xs transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-1 stroke-[3]" />
                    Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-white dark:bg-[#181818] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white p-1.5 rounded-2xl shadow-xl"
                >
                  <DropdownMenuItem
                    className="focus:bg-gray-100 dark:focus:bg-neutral-800 cursor-pointer rounded-xl py-2.5 gap-2.5"
                    onClick={() => navigate("/artist/upload")}
                  >
                    <Video className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-xs uppercase tracking-tight">Upload Video</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="focus:bg-gray-100 dark:focus:bg-neutral-800 cursor-pointer rounded-xl py-2.5 gap-2.5"
                    onClick={() => navigate("/artist/live")}
                  >
                    <Radio className="w-4 h-4 text-red-500" />
                    <span className="font-bold text-xs uppercase tracking-tight">Go Live</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Real-time Notifications Bell */}
            <NotificationsBell />

            {/* User Profile Avatar or Sign In */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="header-user-avatar-btn"
                    className="flex items-center rounded-full ring-2 ring-amber-500/50 hover:ring-amber-500 transition-all p-0.5"
                  >
                    <Avatar className="w-8 h-8">
                      {user?.user_metadata?.avatar_url ? (
                        <AvatarImage src={user.user_metadata.avatar_url} />
                      ) : null}
                      <AvatarFallback className="bg-amber-500 text-black font-bold text-xs">
                        {user?.email?.charAt(0).toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-white dark:bg-[#181818] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white p-1.5 rounded-2xl shadow-2xl"
                >
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <p className="font-bold text-sm truncate">{user?.email || "PayTune Member"}</p>
                    <p className="text-[11px] text-amber-500 font-semibold">70/30 Creator Monetization</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800 my-1" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-xl py-2 px-2.5 text-xs focus:bg-gray-100 dark:focus:bg-neutral-800"
                    onClick={() => navigate("/dashboard")}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2 text-amber-500" />
                    <span>My Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-xl py-2 px-2.5 text-xs focus:bg-gray-100 dark:focus:bg-neutral-800"
                    onClick={() => navigate("/artist/dashboard")}
                  >
                    <Video className="w-4 h-4 mr-2 text-red-500" />
                    <span>Creator Studio</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-xl py-2 px-2.5 text-xs focus:bg-gray-100 dark:focus:bg-neutral-800"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800 my-1" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-xl py-2 px-2.5 text-xs focus:bg-rose-500/20 text-rose-500"
                    onClick={() => signOut()}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/60 hover:border-amber-500 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 text-xs font-bold transition-all cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </>
      )}
    </header>
  );
}
