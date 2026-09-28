import React from 'react';
import { ArrowUpDown, Video, Sparkles, Filter } from 'lucide-react';
import ChannelVideoCard from './ChannelVideoCard';
import { VideoSortType } from '../hooks/useChannelTabs';

interface ChannelVideoGridProps {
  videos: any[];
  loading: boolean;
  sort: VideoSortType;
  onSortChange: (sort: VideoSortType) => void;
  title?: string;
  emptyMessage?: string;
}

export default function ChannelVideoGrid({
  videos,
  loading,
  sort,
  onSortChange,
  title = "Videos",
  emptyMessage = "No videos published yet by this artist."
}: ChannelVideoGridProps) {
  return (
    <div id="channel-video-grid-section" className="space-y-6">
      {/* Grid Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            {title}
            <span className="text-xs font-normal text-neutral-400">
              ({videos.length})
            </span>
          </h2>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label htmlFor="video-sort-select" className="text-xs text-neutral-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FFB300]" />
            <span>Sort by:</span>
          </label>
          <select
            id="video-sort-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as VideoSortType)}
            className="bg-[#1A1A1A] border border-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FFB300] hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <option value="newest">Latest Releases (Newest)</option>
            <option value="most_popular">Most Popular (Views)</option>
            <option value="oldest">Earliest Releases (Oldest)</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <div key={n} className="bg-[#181818] rounded-xl overflow-hidden border border-neutral-800/60 animate-pulse">
              <div className="aspect-video bg-neutral-800 w-full" />
              <div className="p-3.5 space-y-2">
                <div className="h-4 bg-neutral-800 rounded w-5/6" />
                <div className="h-3 bg-neutral-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Videos Grid */}
      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.map(video => (
            <ChannelVideoCard key={video.id} video={video} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && videos.length === 0 && (
        <div className="py-16 text-center bg-[#141414] rounded-2xl border border-neutral-800/80 px-4">
          <div className="w-16 h-16 bg-neutral-800/60 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFB300]">
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No Content Found</h3>
          <p className="text-sm text-neutral-400 max-w-md mx-auto mb-4">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
