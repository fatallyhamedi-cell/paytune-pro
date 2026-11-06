import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import CategoryBar from '../components/CategoryBar';

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views: number;
  artists?: { full_name: string; avatar_url: string | null };
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [trending, setTrending] = useState<Video[]>([]);
  const [recent, setRecent] = useState<Video[]>([]);
  const [recommended, setRecommended] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [t, n, r] = await Promise.all([
          api.get('/videos/trending').catch(() => ({ data: { videos: [] } })),
          api.get('/videos/new').catch(() => ({ data: { videos: [] } })),
          api.get('/videos/recommended').catch(() => ({ data: { videos: [] } })),
        ]);
        setTrending(t.data.videos || []);
        setRecent(n.data.videos || []);
        setRecommended(r.data.videos || []);
      } catch (err) {
        console.error('[Home] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <CategoryBar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 border border-gray-200 rounded-xl aspect-video animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const total = trending.length + recent.length + recommended.length;

  if (total === 0) {
    return (
      <div className="bg-white min-h-screen">
        <CategoryBar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-gray-900 text-xl font-semibold mb-2">No videos yet</h2>
          <p className="text-gray-500 mb-6 max-w-md">
            Artists haven't uploaded any videos yet. Be the first to share your talent.
          </p>
          <Link
            to="/artist/signup"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            Become an artist
          </Link>
        </div>
      </div>
    );
  }

  const Section = ({ title, videos }: { title: string; videos: Video[] }) => {
    if (videos.length === 0) return null;
    return (
      <section className="mb-8">
        <h2 className="text-gray-900 text-xl font-bold mb-4">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Link
              key={v.id}
              to={`/watch/${v.id}`}
              className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden hover:ring-2 hover:ring-purple-600 transition group"
            >
              <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform" />
              <div className="p-3">
                <p className="text-gray-900 text-sm font-semibold truncate group-hover:text-purple-600 transition-colors">{v.title}</p>
                <p className="text-gray-500 text-xs font-medium mt-0.5">{v.artists?.full_name || 'PayTune Creator'}</p>
                <p className="text-gray-400 text-xs mt-0.5">{v.views || 0} views</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="bg-white min-h-screen text-gray-900">
      <CategoryBar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <Section title="🔥 Trending" videos={trending} />
        <Section title="🆕 New Releases" videos={recent} />
        <Section title="🎯 Recommended" videos={recommended} />
      </div>
    </div>
  );
}
