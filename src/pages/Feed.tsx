import React, { useState, useEffect } from 'react';
import { Compass, Users, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import VideoCard from '../components/VideoCard';
import SectionTitle from '../components/SectionTitle';
import { VideoData } from '../hooks/useVideo';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function FeedPage() {
  const { user } = useAuth();
  const [feedVideos, setFeedVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('paytune_auth_token');
        const res = await api.get('/api/videos/feed', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => api.get('/api/videos?limit=20'));

        setFeedVideos(res.data?.videos || res.data || []);
      } catch (err) {
        console.error('Failed to fetch feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <SectionTitle
        title="Your Feed"
        subtitle="Latest releases from artists you follow"
        icon={Compass}
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
      ) : feedVideos.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 bg-zinc-900/30 rounded-3xl border border-zinc-800/60 p-8">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
          <p className="text-lg font-medium text-zinc-300">Your feed is currently empty</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto mb-4">
            Follow your favorite Rwandan artists to see their newest video drops and exclusives right here.
          </p>
          <Link
            to="/trending"
            className="inline-flex items-center px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs transition-colors"
          >
            Explore Artists & Trending
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {feedVideos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
