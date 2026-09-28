import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Film, Music, User, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import VideoCard from '../components/VideoCard';
import SearchBar from '../components/SearchBar';
import { VideoData } from '../hooks/useVideo';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'video' | 'music'>('all');

  useEffect(() => {
    if (!query.trim()) {
      setVideos([]);
      return;
    }

    const fetchSearchResults = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/videos?q=${encodeURIComponent(query)}`);
        setVideos(res.data?.videos || res.data || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  const filteredVideos = videos.filter(v => {
    if (filter === 'all') return true;
    if (filter === 'music') return v.category?.toLowerCase() === 'music';
    return v.category?.toLowerCase() !== 'music';
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Search Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <SearchBar initialQuery={query} onSearch={q => setSearchParams({ q })} />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
            }`}
          >
            All Results
          </button>
          <button
            onClick={() => setFilter('music')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              filter === 'music'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Music</span>
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              filter === 'video'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Videos</span>
          </button>
        </div>

        <span className="text-xs text-zinc-500">
          {filteredVideos.length} {filteredVideos.length === 1 ? 'result' : 'results'} found
        </span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-video bg-zinc-800 rounded-xl" />
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-zinc-400">No results found for "{query}"</p>
          <p className="text-xs text-zinc-600 mt-1">Try searching for artists, songs, or different keywords</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredVideos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
