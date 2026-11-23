import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { FollowButton } from '../components/FollowButton';

interface PublicArtist {
  id: string;
  full_name: string;
  username?: string;
  bio?: string;
  profile_image?: string;
  is_verified?: boolean;
  subscriber_count?: number;
  video_count?: number;
}

export default function DiscoverArtistsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});
  const [countOffsets, setCountOffsets] = useState<Record<string, number>>({});

  const { data: artists = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['discover-artists'],
    queryFn: async () => {
      const res = await api.get('/api/artists');
      return Array.isArray(res.data) ? (res.data as PublicArtist[]) : [];
    },
    staleTime: 60 * 1000,
  });

  const { data: followedIds = new Set<string>(), refetch: refetchFollowed } = useQuery({
    queryKey: ['following-artists', 'ids', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const res = await api.get('/api/user/following/artists', {
        params: { limit: 100, offset: 0, envelope: 1 },
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.artists || [];
      return new Set<string>(list.map((item: any) => String(item.artist_id || item.id)));
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) =>
        (a.full_name || '').toLowerCase().includes(q) ||
        (a.username || '').toLowerCase().includes(q) ||
        (a.bio || '').toLowerCase().includes(q)
    );
  }, [artists, searchQuery]);

  return (
    <div id="discover-artists-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-purple-600" />
            <span>Discover Artists</span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Explore creators on PAYTUNE and follow your favorites to customize your sidebar and feed.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-gray-200 dark:bg-[#181818] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white dark:bg-[#161616] border border-rose-200 dark:border-rose-500/30 rounded-2xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Unable to load artists right now.</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {searchQuery ? `No artists matched "${searchQuery}".` : 'No public artists are listed yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((artist) => {
            const isFollowed = followedIds.has(String(artist.id));
            const baseCount = artist.subscriber_count || 0;
            const displayCount = Math.max(0, baseCount + (countOffsets[artist.id] || 0));
            const showAvatar = Boolean(artist.profile_image && !brokenAvatars[artist.id]);

            return (
              <div
                key={artist.id}
                className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-purple-500/40 transition-colors"
              >
                <Link to={`/artist/${artist.id}`} className="flex items-start gap-3.5 group">
                  {showAvatar ? (
                    <img
                      src={artist.profile_image}
                      alt={artist.full_name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenAvatars((prev) => ({ ...prev, [artist.id]: true }))
                      }
                      className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 font-bold text-lg flex items-center justify-center border border-purple-500/20 shrink-0">
                      {artist.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {artist.full_name}
                      </h2>
                      {artist.is_verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      )}
                    </div>
                    {artist.username && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        @{artist.username}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                      {displayCount.toLocaleString()} followers · {(artist.video_count || 0).toLocaleString()} videos
                    </p>
                  </div>
                </Link>

                {artist.bio && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {artist.bio}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Link
                    to={`/artist/${artist.id}`}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    Open Channel
                  </Link>
                  <FollowButton
                    artistId={artist.id}
                    initialFollowed={isFollowed}
                    size="sm"
                    onFollowChange={(next) => {
                      const delta = next === isFollowed ? 0 : next ? 1 : -1;
                      setCountOffsets((prev) => ({ ...prev, [artist.id]: delta }));
                      refetchFollowed();
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
