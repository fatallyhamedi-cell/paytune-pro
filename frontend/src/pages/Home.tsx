import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views: number;
  artists?: { full_name: string; avatar_url: string | null };
}

export default function Home() {
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
      <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-[#1A1A1A] rounded-xl aspect-video animate-pulse" />
        ))}
      </div>
    );
  }

  const total = trending.length + recent.length + recommended.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="text-6xl mb-4">🎬</div>
        <h2 className="text-white text-xl font-semibold mb-2">No videos yet</h2>
        <p className="text-gray-400 mb-6 max-w-md">
          Artists haven't uploaded any videos yet. Be the first to share your talent.
        </p>
        <Link to="/artist/signup" className="bg-amber-500 text-black font-semibold px-6 py-3 rounded-lg">
          Become an artist
        </Link>
      </div>
    );
  }

  const Section = ({ title, videos }: { title: string; videos: Video[] }) => {
    if (videos.length === 0) return null;
    return (
      <section className="mb-8">
        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Link key={v.id} to={`/watch/${v.id}`} className="bg-[#1A1A1A] rounded-xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition">
              <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover" />
              <div className="p-3">
                <p className="text-white text-sm font-semibold truncate">{v.title}</p>
                <p className="text-gray-400 text-xs">{v.artists?.full_name || 'Unknown'}</p>
                <p className="text-gray-500 text-xs">{v.views || 0} views</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="p-4">
      <Section title="🔥 Trending" videos={trending} />
      <Section title="🆕 New Releases" videos={recent} />
      <Section title="🎯 Recommended" videos={recommended} />
    </div>
  );
}
