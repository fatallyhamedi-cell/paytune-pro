import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  CheckCircle2,
  UserCheck,
  Compass,
  Play,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { notifyFollowingChanged, FOLLOWING_CHANGED_EVENT } from '../lib/followingEvents';

interface FollowedArtistRecord {
  id: string;
  artist_id: string;
  full_name: string;
  artist_name?: string;
  username?: string;
  profile_image?: string;
  avatar_url?: string;
  subscriber_count?: number;
  video_count?: number;
  is_verified?: boolean;
  bio?: string;
  followed_at?: string;
}

const PAGE_SIZE = 24;

export default function FollowingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPage(0);
  }, [user?.id]);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['following-artists', 'full', user?.id ?? 'anonymous', page],
    queryFn: async () => {
      const res = await api.get('/api/user/following/artists', {
        params: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          envelope: 1,
        },
      });
      const payload = res.data;
      if (Array.isArray(payload)) {
        return {
          artists: payload as FollowedArtistRecord[],
          total: payload.length,
          hasMore: false,
        };
      }
      return {
        artists: (payload?.artists || []) as FollowedArtistRecord[],
        total: Number(payload?.total || 0),
        hasMore: Boolean(payload?.hasMore),
      };
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
  });

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['following-feed', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const res = await api.get('/api/user/following', {
        params: { limit: 12, offset: 0 },
      });
      return res.data?.items || [];
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const onFollowingChanged = () => {
      if (user?.id) {
        refetch();
      }
    };
    window.addEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged);
    return () => window.removeEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged);
  }, [user?.id, refetch]);

  const artists = data?.artists || [];
  const totalCount = data?.total || artists.length;
  const hasMore = Boolean(data?.hasMore);

  const filteredArtists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) =>
        (a.full_name || a.artist_name || '').toLowerCase().includes(q) ||
        (a.username || '').toLowerCase().includes(q)
    );
  }, [artists, searchQuery]);

  const handleUnfollow = async (artistId: string, artistName: string) => {
    if (!user || unfollowingId) return;
    setUnfollowingId(artistId);
    try {
      await api.delete(`/api/artists/${artistId}/follow`);
      notifyFollowingChanged(user.id);
      setStatusNotice(`Unfollowed ${artistName}`);
      setTimeout(() => setStatusNotice(null), 3000);
      await refetch();
    } catch {
      setStatusNotice(`Could not unfollow ${artistName}. Please try again.`);
      setTimeout(() => setStatusNotice(null), 3000);
    } finally {
      setUnfollowingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center space-y-4">
          <Users className="w-10 h-10 text-purple-600 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Following Artists
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            You haven&apos;t followed any artists yet. Sign in to view artists you follow and keep up with their newest drops.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/auth?redirect=/follows"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
            <Link
              to="/artists"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-semibold transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Discover Artists</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="following-artists-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {statusNotice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold rounded-xl shadow-xl"
        >
          {statusNotice}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Following Artists
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 tabular-nums">
            {totalCount} {totalCount === 1 ? 'artist' : 'artists'} followed on PAYTUNE
          </p>
        </div>

        <div className="flex items-center gap-3">
          {artists.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter followed artists..."
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
              />
            </div>
          )}
          <Link
            to="/artists"
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap shrink-0 transition-colors"
          >
            <Compass className="w-4 h-4 text-purple-600" />
            <span>Discover Artists</span>
          </Link>
        </div>
      </div>

      {/* Artists Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-2xl bg-gray-200 dark:bg-[#181818] animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white dark:bg-[#161616] border border-rose-200 dark:border-rose-500/30 rounded-2xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Could not load your followed artists right now.</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : totalCount === 0 ? (
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-10 text-center space-y-4">
          <Users className="w-10 h-10 text-gray-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              You haven&apos;t followed any artists yet.
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              When you follow artists across PAYTUNE, their profiles and latest releases appear here and in your sidebar.
            </p>
          </div>
          <Link
            to="/artists"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Artists</span>
          </Link>
        </div>
      ) : filteredArtists.length === 0 ? (
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No followed artists matched &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredArtists.map((artist) => {
              const name = artist.full_name || artist.artist_name || 'Artist';
              const avatarUrl = artist.profile_image || artist.avatar_url || '';
              const showImage = Boolean(avatarUrl && !brokenAvatars[artist.artist_id]);

              return (
                <div
                  key={artist.artist_id}
                  className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-purple-500/40 transition-colors"
                >
                  <Link
                    to={`/artist/${artist.artist_id}`}
                    className="flex items-start gap-3.5 group"
                  >
                    {showImage ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenAvatars((prev) => ({ ...prev, [artist.artist_id]: true }))
                        }
                        className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 font-bold text-lg flex items-center justify-center border border-purple-500/20 shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {name}
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
                        {(artist.subscriber_count || 0).toLocaleString()} followers · {(artist.video_count || 0).toLocaleString()} videos
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link
                      to={`/artist/${artist.artist_id}`}
                      className="flex-1 text-center py-2 px-3 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-purple-600 hover:text-white text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors"
                    >
                      View Channel
                    </Link>
                    <button
                      type="button"
                      disabled={unfollowingId === artist.artist_id}
                      onClick={() => handleUnfollow(artist.artist_id, name)}
                      className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-rose-400 hover:text-rose-500 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {unfollowingId === artist.artist_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Following</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(page > 0 || hasMore) && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Latest Releases from Followed Artists */}
      {totalCount > 0 && (
        <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Latest from Artists You Follow
          </h2>

          {feedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-gray-200 dark:bg-[#181818] animate-pulse" />
              ))}
            </div>
          ) : !feedData || feedData.length === 0 ? (
            <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-sm text-gray-500 dark:text-gray-400">
              No recent video uploads from your followed artists yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {feedData.map((video: any) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => navigate(`/watch/${video.id}`)}
                  className="text-left group bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/40 transition-colors cursor-pointer"
                >
                  <div className="relative aspect-video bg-gray-900">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <Play className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {video.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {video.artist_name} · {(video.views || 0).toLocaleString()} views
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
