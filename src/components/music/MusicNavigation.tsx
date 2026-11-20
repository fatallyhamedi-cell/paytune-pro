import React from 'react';
import {
  Compass,
  Flame,
  Sparkles,
  Globe2,
  ListMusic,
  Users,
  Disc3,
  Heart,
  Music2,
  Search,
} from 'lucide-react';

export type MusicNavTab =
  | 'home'
  | 'discover'
  | 'trending'
  | 'new_releases'
  | 'african_music'
  | 'playlists'
  | 'artists'
  | 'albums'
  | 'my_music';

interface MusicNavigationProps {
  activeTab: MusicNavTab;
  onTabChange: (tab: MusicNavTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function MusicNavigation({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: MusicNavigationProps) {
  const navTabs: { id: MusicNavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Music Home', icon: Music2 },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'new_releases', label: 'New Releases', icon: Sparkles },
    { id: 'african_music', label: 'African Music', icon: Globe2 },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'artists', label: 'Artists', icon: Users },
    { id: 'albums', label: 'Albums', icon: Disc3 },
    { id: 'my_music', label: 'My Music', icon: Heart },
  ];

  return (
    <div className="w-full bg-white border-b border-gray-200 py-2.5 px-4 sticky top-14 z-30 backdrop-blur-md bg-white/95 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Horizontal Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-hide py-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#8B5CF6] text-white shadow-xs'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar for Songs, Artists, Genres, Albums */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search songs, artists, genres..."
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
