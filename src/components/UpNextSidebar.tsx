import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { VideoData } from '../hooks/useVideo';

interface UpNextSidebarProps {
  currentVideoId: string;
  artistName: string;
  category: string;
  relatedVideos: VideoData[];
  loadingRelated: boolean;
  autoplay: boolean;
  onToggleAutoplay: (state: boolean) => void;
}

export const UpNextSidebar: React.FC<UpNextSidebarProps> = ({
  currentVideoId,
  artistName,
  category,
  relatedVideos,
  loadingRelated,
  autoplay,
  onToggleAutoplay
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'artist' | 'category'>('all');

  // Format seconds to mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format views
  const formatViews = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const filteredList = relatedVideos.filter(v => {
    if (activeFilter === 'artist') return v.artist_name.toLowerCase() === artistName.toLowerCase();
    if (activeFilter === 'category') return v.category?.toLowerCase() === category.toLowerCase();
    return true;
  });

  return (
    <div id="up-next-sidebar" className="space-y-4">
      {/* Top Header: Autoplay Switch */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" /> Up Next
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Autoplay</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => onToggleAutoplay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-gray-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-amber-500 text-black font-extrabold shadow-sm'
              : 'bg-gray-100 dark:bg-[#181818] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#272727] border border-gray-200 dark:border-gray-800'
          }`}
        >
          All
        </button>

        <button
          onClick={() => setActiveFilter('artist')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-all cursor-pointer ${
            activeFilter === 'artist'
              ? 'bg-amber-500 text-black font-extrabold shadow-sm'
              : 'bg-gray-100 dark:bg-[#181818] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#272727] border border-gray-200 dark:border-gray-800'
          }`}
        >
          By {artistName.split(' ')[0]}
        </button>

        <button
          onClick={() => setActiveFilter('category')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-all cursor-pointer ${
            activeFilter === 'category'
              ? 'bg-amber-500 text-black font-extrabold shadow-sm'
              : 'bg-gray-100 dark:bg-[#181818] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#272727] border border-gray-200 dark:border-gray-800'
          }`}
        >
          {category || "Afrobeats"}
        </button>
      </div>

      {/* Video Cards List */}
      {loadingRelated ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex gap-3 animate-pulse">
              <div className="w-36 h-20 bg-gray-200 dark:bg-[#181818] rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 bg-gray-200 dark:bg-[#181818] rounded w-4/5" />
                <div className="h-3 bg-gray-200 dark:bg-[#181818] rounded w-1/2" />
                <div className="h-3 bg-gray-200 dark:bg-[#181818] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          No related videos found in this category.
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {filteredList.map((item) => {
            const isItemFree = item.is_free;
            return (
              <Link
                key={item.id}
                to={`/watch/${item.id}`}
                className="group flex gap-3 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#181818] transition-colors"
              >
                {/* Thumbnail Container */}
                <div className="relative w-36 sm:w-40 aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0 border border-gray-200 dark:border-gray-800 group-hover:border-amber-500/50 transition-colors">
                  <img
                    src={item.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600"}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Duration Badge */}
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-semibold text-white">
                    {formatDuration(item.duration || 210)}
                  </span>

                  {/* Price / Free Badge */}
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                    isItemFree
                      ? 'bg-emerald-500 text-white font-extrabold'
                      : 'bg-amber-500 text-black font-extrabold shadow-sm'
                  }`}>
                    {isItemFree ? 'FREE' : `${item.price_rwf?.toLocaleString()} RWF`}
                  </span>
                </div>

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-amber-500 transition-colors leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {item.artist_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                    <span>{formatViews(item.views)} views</span>
                    <span>•</span>
                    <span>{item.category}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
