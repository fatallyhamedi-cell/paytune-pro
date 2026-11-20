import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Sparkles,
  ListVideo,
  Music,
  BookOpen,
  Film,
  Compass,
} from 'lucide-react';
import { VideoData } from '../hooks/useVideo';

export type SidebarContentType = 'series' | 'music' | 'course' | 'movie' | 'short' | string;

interface UpNextSidebarProps {
  currentVideoId: string;
  artistName: string;
  category: string;
  contentType?: SidebarContentType;
  relatedVideos: VideoData[];
  loadingRelated: boolean;
  autoplay: boolean;
  onToggleAutoplay: (state: boolean) => void;
}

export const UpNextSidebar: React.FC<UpNextSidebarProps> = ({
  currentVideoId,
  artistName,
  category,
  contentType,
  relatedVideos,
  loadingRelated,
  autoplay,
  onToggleAutoplay,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'artist' | 'category'>('all');

  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hrs > 0) {
      return `${hrs < 10 ? '0' : ''}${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatViews = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num || 0);
  };

  // Resolve dynamic sidebar heading & selector label based on content type / category
  const resolveContextHeader = () => {
    const normalizedType = String(contentType || '').toLowerCase();
    const normalizedCat = String(category || '').toLowerCase();

    if (
      normalizedType === 'series' ||
      normalizedCat.includes('series') ||
      normalizedCat.includes('drama') ||
      normalizedCat.includes('podcast')
    ) {
      return {
        title: 'All Episodes',
        badge: 'All Episodes',
        Icon: ListVideo,
        subtitle: 'Episodes & seasons in this series',
      };
    }

    if (
      normalizedType === 'course' ||
      normalizedCat.includes('course') ||
      normalizedCat.includes('tutorial') ||
      normalizedCat.includes('lesson')
    ) {
      return {
        title: 'Course Content',
        badge: 'Modules',
        Icon: BookOpen,
        subtitle: 'Ordered curriculum lessons',
      };
    }

    if (normalizedType === 'movie' || normalizedCat.includes('movie') || normalizedCat.includes('film')) {
      return {
        title: 'Similar Movies',
        badge: category || 'Movies',
        Icon: Film,
        subtitle: 'Feature films & premieres',
      };
    }

    if (normalizedType === 'music' || normalizedCat.includes('music') || normalizedCat.includes('afro') || normalizedCat.includes('gospel') || normalizedCat.includes('rwandan')) {
      const shortArtist = artistName ? artistName.split(' ')[0] : 'Artist';
      return {
        title: `Up Next · ${category || 'Music'}`,
        badge: `More from ${shortArtist}`,
        Icon: Music,
        subtitle: `Music videos & tracks by ${artistName}`,
      };
    }

    return {
      title: 'Up Next',
      badge: category || 'Recommended',
      Icon: Sparkles,
      subtitle: 'Auto-queued recommendations',
    };
  };

  const { title: headerTitle, badge: headerBadge, Icon: HeaderIcon } = resolveContextHeader();

  const filteredList = relatedVideos.filter((v) => {
    if (activeFilter === 'artist') {
      return (v.artist_name || '').toLowerCase() === (artistName || '').toLowerCase();
    }
    if (activeFilter === 'category') {
      return (v.category || '').toLowerCase() === (category || '').toLowerCase();
    }
    return true;
  });

  const primaryList = filteredList.slice(0, 8);
  const similarRecommendations = filteredList.slice(8, 12);

  return (
    <aside
      id="up-next-sidebar"
      className="w-full flex flex-col max-h-[760px] bg-[#0F0F0F] text-white rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden"
    >
      {/* Dynamic Header Bar (Matches reference dark tab aesthetic adapted to PayTune purple) */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between gap-2 bg-[#141414]">
        <div className="flex items-center gap-2 min-w-0">
          <HeaderIcon className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          <h3 className="font-extrabold text-sm sm:text-base tracking-tight truncate">
            {headerTitle}
          </h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'all' ? 'artist' : 'all')}
            className="hidden sm:inline-block border border-white/80 px-2.5 py-1 rounded text-[11px] font-bold hover:bg-white hover:text-black transition-colors cursor-pointer"
          >
            {headerBadge}
          </button>

          <label className="relative inline-flex items-center gap-1.5 cursor-pointer" title="Toggle Autoplay">
            <span className="text-[11px] text-neutral-400 font-medium">Auto</span>
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => onToggleAutoplay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[18px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#8B5CF6]" />
          </label>
        </div>
      </div>

      {/* Filter Chips Row */}
      <div className="px-3.5 py-2.5 border-b border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs bg-[#121212]">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'bg-[#1D1D1D] text-neutral-300 hover:bg-[#272727] border border-neutral-800'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('artist')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all cursor-pointer ${
            activeFilter === 'artist'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'bg-[#1D1D1D] text-neutral-300 hover:bg-[#272727] border border-neutral-800'
          }`}
        >
          By {artistName ? artistName.split(' ')[0] : 'Artist'}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('category')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all cursor-pointer ${
            activeFilter === 'category'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'bg-[#1D1D1D] text-neutral-300 hover:bg-[#272727] border border-neutral-800'
          }`}
        >
          {category || 'Afrobeat'}
        </button>
      </div>

      {/* Scrollable Video / Episode List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loadingRelated ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex gap-3 animate-pulse p-1.5">
                <div className="w-32 aspect-video bg-neutral-800 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3.5 bg-neutral-800 rounded w-4/5" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : primaryList.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <Play className="w-7 h-7 text-neutral-600 mx-auto" />
            <p className="text-xs font-semibold text-neutral-400">
              No matching videos in this queue yet.
            </p>
            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="text-xs text-[#8B5CF6] hover:underline font-bold cursor-pointer"
              >
                Show all related items
              </button>
            )}
          </div>
        ) : (
          primaryList.map((item) => {
            const isCurrent = String(item.id) === String(currentVideoId);
            const isNewItem = Boolean((item as any).is_new);
            return (
              <Link
                key={item.id}
                to={`/watch/${item.id}`}
                className={`group flex items-center gap-3 p-2 rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/40'
                    : 'hover:bg-[#1B1B1B] border border-transparent'
                }`}
              >
                <div className="relative w-32 sm:w-36 aspect-video bg-neutral-800 rounded-lg overflow-hidden shrink-0">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
                      <Play className="w-5 h-5" />
                    </div>
                  )}

                  {/* NEW Badge (Matching reference top-left red badge) */}
                  {isNewItem && (
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                      NEW
                    </span>
                  )}

                  {/* Paid / Free Micro Pill if paid */}
                  {!item.is_free && (
                    <span className="absolute top-1 right-1 bg-[#8B5CF6] text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                      {item.price_rwf ? `${item.price_rwf.toLocaleString()} RWF` : 'PRO'}
                    </span>
                  )}

                  {/* Duration Overlay */}
                  <span className="absolute bottom-1 right-1 bg-black/85 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {formatDuration(item.duration || 210)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-100 group-hover:text-[#8B5CF6] transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 truncate">
                    {item.artist_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-0.5">
                    <span>{formatViews(item.views)} views</span>
                    <span>•</span>
                    <span>{item.category}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer Area: Similar Recommendations (Matching reference layout bottom drawer) */}
      <div className="p-4 bg-[#161616] border-t border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-sm text-white">Similar Recommendations</h4>
          <Link
            to="/trending"
            className="text-[11px] font-bold text-[#8B5CF6] hover:underline flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Explore</span>
          </Link>
        </div>

        {similarRecommendations.length > 0 ? (
          <div className="space-y-2">
            {similarRecommendations.map((rec) => (
              <Link
                key={rec.id}
                to={`/watch/${rec.id}`}
                className="flex items-center gap-2.5 group text-xs hover:bg-neutral-900 p-1 rounded-lg transition-colors"
              >
                <div className="w-16 aspect-video rounded bg-neutral-800 overflow-hidden shrink-0">
                  {rec.thumbnail_url && (
                    <img
                      src={rec.thumbnail_url}
                      alt={rec.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-200 group-hover:text-[#8B5CF6] truncate">
                    {rec.title}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">{rec.artist_name}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400">
            Browse trending releases and curated channels across PayTune.
          </p>
        )}
      </div>
    </aside>
  );
};
