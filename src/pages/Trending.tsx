import React, { useState, useEffect } from 'react';
import { Flame, TrendingUp, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import VideoCard from '../components/VideoCard';
import SectionTitle from '../components/SectionTitle';
import { VideoData } from '../hooks/useVideo';

export default function TrendingPage() {
  const [trendingVideos, setTrendingVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/videos?trending=true&limit=24');
        setTrendingVideos(res.data?.videos || res.data || []);
      } catch (err) {
        console.error('Failed to fetch trending videos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <SectionTitle
        title="Trending in Rwanda"
        subtitle="The most popular music videos and tracks right now"
        icon={Flame}
      />

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
      ) : trendingVideos.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-zinc-400">No trending content at the moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {trendingVideos.map((video, index) => (
            <div key={video.id} className="relative">
              <span className="absolute -top-3 -left-2 z-10 w-7 h-7 rounded-full bg-amber-500 text-black text-xs font-black flex items-center justify-center shadow-lg border border-black/40">
                #{index + 1}
              </span>
              <VideoCard video={video} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
