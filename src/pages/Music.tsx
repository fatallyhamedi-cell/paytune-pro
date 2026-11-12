import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Music2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  Download,
  ShoppingBag,
  Sparkles,
  Users,
  Clock,
  CheckCircle2,
  Disc,
  Radio,
  Search,
  Filter
} from 'lucide-react';
import api from '../services/api';

interface Track {
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  album_title?: string;
  genre: string;
  duration_seconds: number;
  artwork_url: string;
  audio_url: string;
  is_free: boolean;
  price_rwf: number;
  plays_count: number;
  likes_count: number;
  release_year: number;
}

const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Katerina (Remix)',
    artist_name: 'Bruce Melodie',
    artist_id: 'artist-melodie-01',
    album_title: 'Kigali Vibrations',
    genre: 'Rwandan Hits',
    duration_seconds: 214,
    artwork_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    is_free: true,
    price_rwf: 0,
    plays_count: 142500,
    likes_count: 18400,
    release_year: 2025,
  },
  {
    id: 'track-2',
    title: 'Amapiano Sunrise',
    artist_name: 'DJ Maphorisa & Kabza',
    artist_id: 'artist-amapiano-02',
    album_title: 'Scorpion Kings EP',
    genre: 'Amapiano',
    duration_seconds: 285,
    artwork_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    is_free: false,
    price_rwf: 500,
    plays_count: 98200,
    likes_count: 12100,
    release_year: 2025,
  },
  {
    id: 'track-3',
    title: 'Lagos to Kigali',
    artist_name: 'Burna Boy ft. Meddy',
    artist_id: 'artist-burna-03',
    album_title: 'Love, Damini Extra',
    genre: 'Afrobeats',
    duration_seconds: 198,
    artwork_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    is_free: true,
    price_rwf: 0,
    plays_count: 310000,
    likes_count: 45000,
    release_year: 2026,
  },
  {
    id: 'track-4',
    title: 'Ni Wowe Mwami',
    artist_name: 'Israel Mbonyi',
    artist_id: 'artist-mbonyi-04',
    album_title: 'Harakabaho Gospel',
    genre: 'Gospel & Worship',
    duration_seconds: 340,
    artwork_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    is_free: true,
    price_rwf: 0,
    plays_count: 520000,
    likes_count: 67000,
    release_year: 2025,
  },
  {
    id: 'track-5',
    title: 'Bongo Flava Nights',
    artist_name: 'Diamond Platnumz',
    artist_id: 'artist-diamond-05',
    album_title: 'First Of All',
    genre: 'Bongo Flava',
    duration_seconds: 226,
    artwork_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    is_free: false,
    price_rwf: 1000,
    plays_count: 215000,
    likes_count: 29000,
    release_year: 2025,
  },
  {
    id: 'track-6',
    title: 'Highlife Harmony',
    artist_name: 'Kidi & Kuami Eugene',
    artist_id: 'artist-kidi-06',
    album_title: 'Golden Boy Africa',
    genre: 'Highlife',
    duration_seconds: 205,
    artwork_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    is_free: true,
    price_rwf: 0,
    plays_count: 87000,
    likes_count: 11400,
    release_year: 2026,
  },
];

const GENRES = [
  'All',
  'Rwandan Hits',
  'Afrobeats',
  'Amapiano',
  'Gospel & Worship',
  'Bongo Flava',
  'Highlife',
];

export default function Music() {
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentTrack, setCurrentTrack] = useState<Track>(DEFAULT_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(DEFAULT_TRACKS[0].duration_seconds);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Attempt to load tracks from backend
    api.get('/videos')
      .then((res) => {
        const videoList = res.data?.videos || res.data || [];
        const audioMapped: Track[] = videoList
          .filter((v: any) => v.category === 'Music' || v.audio_url || v.tags?.includes('music'))
          .map((v: any, idx: number) => ({
            id: `v-track-${v.id}`,
            title: v.title,
            artist_name: v.artist?.full_name || v.artists?.full_name || 'PayTune Artist',
            artist_id: v.artist_id,
            album_title: 'Single Release',
            genre: v.category || 'Afrobeats',
            duration_seconds: v.duration || 210,
            artwork_url: v.thumbnail_url || DEFAULT_TRACKS[idx % DEFAULT_TRACKS.length].artwork_url,
            audio_url: v.audio_url || v.video_url || DEFAULT_TRACKS[idx % DEFAULT_TRACKS.length].audio_url,
            is_free: v.is_free ?? true,
            price_rwf: v.price_rwf || 0,
            plays_count: v.views || 1000,
            likes_count: v.likes || 150,
            release_year: 2025,
          }));

        if (audioMapped.length > 0) {
          setTracks([...audioMapped, ...DEFAULT_TRACKS]);
        }
      })
      .catch((err) => {
        console.warn('Backend audio sync notice (using standard library):', err.message);
      });
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  const handlePlayTrack = (track: Track) => {
    if (currentTrack.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleNext = () => {
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    setCurrentTrack(tracks[nextIndex]);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIndex]);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const toggleLike = (id: string) => {
    const next = new Set(likedTrackIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setLikedTrackIds(next);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTracks = tracks.filter((t) => {
    const matchesGenre = selectedGenre === 'All' || t.genre === selectedGenre;
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <audio
        ref={audioRef}
        src={currentTrack.audio_url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
      />

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 mb-2">
            <Music2 className="w-3.5 h-3.5" />
            <span>PayTune Pan-African Music & Audio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            African Soundtracks & Discographies
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Stream high-bitrate African audio, discover trending Rwandan Hits and Afrobeats, or buy permanent lifetime tracks directly from verified artists.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium focus:outline-none focus:border-purple-600 shadow-sm"
          />
        </div>
      </div>

      {/* 2. Hero Interactive Player Card */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-purple-800">
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10">
          {/* Artwork 1:1 with vinyl spin aesthetic */}
          <div className="relative shrink-0 w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 group">
            <img
              src={currentTrack.artwork_url}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Disc className={`w-12 h-12 text-[#FFB300] ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
          </div>

          {/* Controls & Track Details */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                  {currentTrack.genre} • {currentTrack.album_title || 'Featured Single'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 line-clamp-1">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-purple-200 font-semibold mt-0.5">
                  {currentTrack.artist_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack.id)}
                  className={`p-2.5 rounded-full backdrop-blur-md transition-colors ${
                    likedTrackIds.has(currentTrack.id)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  aria-label="Like track"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Scrubber Progress Bar */}
            <div className="space-y-1.5">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-[#FFB300] h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-purple-200">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls Stack */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-2 text-purple-200 hover:text-white transition-colors"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 rounded-full bg-[#FFB300] hover:bg-amber-400 text-black flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="p-2 text-purple-200 hover:text-white transition-colors"
                  aria-label="Next track"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-purple-200 hover:text-white"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    setIsMuted(v === 0);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="w-20 accent-purple-400 h-1 bg-white/20 rounded-lg cursor-pointer"
                />
              </div>

              {/* Purchase / Price Tag */}
              <div className="flex items-center gap-2">
                {currentTrack.is_free ? (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400 px-3 py-1 rounded-full">
                    Free Stream
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400 px-3 py-1 rounded-full flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{currentTrack.price_rwf} RWF Lifetime</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              selectedGenre === genre
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* 4. Tracks Grid (Responsive across small phones, tablets, laptops, desktop) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">
          {selectedGenre === 'All' ? 'Pan-African Catalog' : `${selectedGenre} Hits`} ({filteredTracks.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTracks.map((track) => {
            const isCurrent = currentTrack.id === track.id;
            const isTrackPlaying = isCurrent && isPlaying;

            return (
              <div
                key={track.id}
                className={`bg-white rounded-2xl p-4 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-3 group ${
                  isCurrent ? 'border-purple-600 ring-1 ring-purple-600' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Square Artwork 1:1 */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 shadow-sm">
                    <img
                      src={track.artwork_url}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <button
                      type="button"
                      onClick={() => handlePlayTrack(track)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {isTrackPlaying ? (
                        <Pause className="w-6 h-6 text-[#FFB300] fill-current" />
                      ) : (
                        <Play className="w-6 h-6 text-[#FFB300] fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-purple-600 truncate">{track.genre}</p>
                    <h3 className="text-sm font-bold text-gray-900 truncate mt-0.5">
                      {track.title}
                    </h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {track.artist_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatTime(track.duration_seconds)}
                    </span>
                    <span>•</span>
                    <span>{(track.plays_count || 0).toLocaleString()} plays</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {track.is_free ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      <span className="text-amber-600 font-bold">{track.price_rwf} RWF</span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleLike(track.id)}
                      className={`p-1 text-gray-400 hover:text-rose-500 transition-colors ${
                        likedTrackIds.has(track.id) ? 'text-rose-500' : ''
                      }`}
                      aria-label="Like track"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
