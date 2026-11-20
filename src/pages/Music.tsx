import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Music2,
  Play,
  Pause,
  Disc,
  Flame,
  Globe2,
  Sparkles,
  Users,
  ChevronRight,
  CheckCircle2,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAudioPlayer, MusicTrack } from '../hooks/useAudioPlayer';
import MusicTrackCard from '../components/music/MusicTrackCard';

interface HomeFeedData {
  madeForYou: MusicTrack[];
  fromArtistsYouFollow: MusicTrack[];
  popularInCountry: MusicTrack[];
  trendingAcrossAfrica: MusicTrack[];
  newReleases: MusicTrack[];
  genres: string[];
  countries: { code: string; name: string }[];
  followedArtists: { id: string; name: string; avatar: string; verified: boolean; followers: number }[];
  likedTrackIds: string[];
}

export default function Music() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCountry = searchParams.get('country') || 'All';

  const [selectedCountry, setSelectedCountry] = useState<string>(initialCountry);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [feedData, setFeedData] = useState<HomeFeedData | null>(null);
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { currentTrack, isPlaying, playTrack } = useAudioPlayer();

  const fetchMusicFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/music/home', {
        params: { country: selectedCountry },
      });
      if (res.data?.success) {
        setFeedData(res.data);
        const combined = [
          ...(res.data.madeForYou || []),
          ...(res.data.trendingAcrossAfrica || []),
          ...(res.data.newReleases || []),
          ...(res.data.popularInCountry || []),
        ];
        const uniqueMap = new Map<string, MusicTrack>();
        combined.forEach((t) => uniqueMap.set(t.id, t));
        setAllTracks(Array.from(uniqueMap.values()));
      } else {
        throw new Error(res.data?.error || 'Failed to load music catalog.');
      }
    } catch (err: any) {
      console.error('Error loading music home feed:', err);
      setError(err?.response?.data?.error || err?.message || 'Unable to load music catalog from database.');
      setFeedData(null);
      setAllTracks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCountry]);

  useEffect(() => {
    fetchMusicFeed();
  }, [fetchMusicFeed]);

  const handleCountrySelect = (code: string) => {
    setSelectedCountry(code);
    const updated = new URLSearchParams(searchParams);
    if (code === 'All') {
      updated.delete('country');
    } else {
      updated.set('country', code);
    }
    setSearchParams(updated);
  };

  const filteredCatalog = allTracks.filter((t) => {
    const matchesCountry = selectedCountry === 'All' || t.country_code === selectedCountry;
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesSearch;
  });

  const spotlightTrack = feedData?.trendingAcrossAfrica?.[0] || allTracks[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Header & Filters (CategoryBar intentionally omitted) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold mb-2">
              <Music2 className="w-3.5 h-3.5" />
              <span>PAYTUNE Music</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Music Catalog & Artist Releases
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Stream published releases stored in PAYTUNE directly from creator channels.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists, genres..."
                className="w-full pl-9 pr-7 py-2 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-purple-600 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {feedData?.countries && feedData.countries.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                {feedData.countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c.code)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedCountry === c.code
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 border border-gray-200 animate-pulse space-y-3"
              >
                <div className="aspect-square rounded-xl bg-gray-200" />
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-8 w-full bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-3xl p-10 border border-red-200 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">Unable to load music tracks</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchMusicFeed}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Honest Empty Database State */}
        {!loading && !error && allTracks.length === 0 && (
          <div className="bg-white rounded-3xl p-12 border border-dashed border-gray-300 text-center space-y-4">
            <Music2 className="w-12 h-12 text-gray-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">No published music tracks yet</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                There are currently no published tracks in the music catalog. Artists can publish audio releases from Studio.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/artist/upload"
                className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
              >
                Upload in Studio
              </Link>
              <button
                type="button"
                onClick={fetchMusicFeed}
                className="px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Hero Spotlight Banner */}
        {!loading && !error && !searchQuery && spotlightTrack && (
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-neutral-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-purple-800">
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10">
              <div className="relative shrink-0 w-36 h-36 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 group bg-purple-900/50 flex items-center justify-center">
                {spotlightTrack.artwork_url ? (
                  <img
                    src={spotlightTrack.artwork_url}
                    alt={spotlightTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <Disc className="w-16 h-16 text-purple-300" />
                )}
                <button
                  type="button"
                  onClick={() => playTrack(spotlightTrack, allTracks)}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Play featured track"
                >
                  <Disc className="w-12 h-12 text-purple-300" />
                </button>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-bold border border-purple-400/30">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Top Track</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight line-clamp-1">
                  {spotlightTrack.title}
                </h2>

                <p className="text-base text-purple-200 font-bold flex items-center gap-2">
                  <Link
                    to={spotlightTrack.artist_id ? `/artist/${spotlightTrack.artist_id}` : '#'}
                    className="hover:underline flex items-center gap-1 text-white"
                  >
                    <span>{spotlightTrack.artist_name}</span>
                    {spotlightTrack.artist_verified && (
                      <CheckCircle2 className="w-4 h-4 text-purple-300 fill-black" />
                    )}
                  </Link>
                  <span>•</span>
                  <span className="text-sm text-purple-300 font-medium">
                    {spotlightTrack.genre}
                  </span>
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => playTrack(spotlightTrack, allTracks)}
                    className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    {currentTrack?.id === spotlightTrack.id && isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-white" />
                        <span>Pause Streaming</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                        <span>Play Track</span>
                      </>
                    )}
                  </button>

                  {spotlightTrack.artist_id && (
                    <Link
                      to={`/artist/${spotlightTrack.artist_id}`}
                      className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <span>Visit Artist Channel</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Results or Discovery Sections */}
        {!loading && !error && allTracks.length > 0 && searchQuery && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              Search Results for &quot;{searchQuery}&quot; ({filteredCatalog.length})
            </h2>
            {filteredCatalog.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-2">
                <Music2 className="w-10 h-10 text-gray-400 mx-auto" />
                <h3 className="text-base font-bold text-gray-800">No matching tracks</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Try another keyword or clear your search query.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCatalog.map((track) => (
                  <MusicTrackCard
                    key={track.id}
                    track={track}
                    allTracks={filteredCatalog}
                    onFollowToggled={() => fetchMusicFeed()}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !error && allTracks.length > 0 && !searchQuery && (
          <div className="space-y-10">
            {feedData?.fromArtistsYouFollow && feedData.fromArtistsYouFollow.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span>From Artists You Follow</span>
                    </h2>
                  </div>
                  <Link
                    to="/follows"
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {feedData.fromArtistsYouFollow.slice(0, 4).map((track) => (
                    <MusicTrackCard
                      key={track.id}
                      track={track}
                      allTracks={feedData.fromArtistsYouFollow}
                      isFollowedInitial={true}
                      onFollowToggled={() => fetchMusicFeed()}
                    />
                  ))}
                </div>
              </div>
            )}

            {feedData?.trendingAcrossAfrica && feedData.trendingAcrossAfrica.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-purple-600 fill-current" />
                  <span>Top Played Tracks</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {feedData.trendingAcrossAfrica.map((track) => (
                    <MusicTrackCard
                      key={track.id}
                      track={track}
                      allTracks={feedData.trendingAcrossAfrica}
                      onFollowToggled={() => fetchMusicFeed()}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedCountry !== 'All' &&
              feedData?.popularInCountry &&
              feedData.popularInCountry.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Globe2 className="w-5 h-5 text-indigo-600" />
                    <span>
                      Popular in{' '}
                      {feedData.countries?.find((c) => c.code === selectedCountry)?.name || selectedCountry}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {feedData.popularInCountry.map((track) => (
                      <MusicTrackCard
                        key={track.id}
                        track={track}
                        allTracks={feedData.popularInCountry}
                        onFollowToggled={() => fetchMusicFeed()}
                      />
                    ))}
                  </div>
                </div>
              )}

            {feedData?.newReleases && feedData.newReleases.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span>New Releases</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {feedData.newReleases.map((track) => (
                    <MusicTrackCard
                      key={track.id}
                      track={track}
                      allTracks={feedData.newReleases}
                      onFollowToggled={() => fetchMusicFeed()}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
