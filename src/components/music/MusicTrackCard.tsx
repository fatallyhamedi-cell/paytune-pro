import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  Heart,
  Clock,
  CheckCircle2,
  Share2,
  Disc,
  MoreVertical,
  ShoppingBag,
  UserPlus,
  UserCheck,
  Music2,
} from 'lucide-react';
import { MusicTrack, useAudioPlayer } from '../../hooks/useAudioPlayer';
import { api } from '../../lib/api';

interface MusicTrackCardProps {
  track: MusicTrack;
  allTracks?: MusicTrack[];
  isFollowedInitial?: boolean;
  onFollowToggled?: (artistId: string, isNowFollowing: boolean) => void;
}

export default function MusicTrackCard({
  track,
  allTracks = [],
  isFollowedInitial = false,
  onFollowToggled,
}: MusicTrackCardProps) {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    likedTrackIds,
    toggleLike,
  } = useAudioPlayer();

  const [isFollowing, setIsFollowing] = useState(isFollowedInitial);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && isPlaying;
  const isLiked = likedTrackIds.has(track.id);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.audio_url) return;
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, allTracks.length > 0 ? allTracks : [track]);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track.id);
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.artist_id || followLoading) return;

    setFollowLoading(true);
    const nextState = !isFollowing;
    setIsFollowing(nextState);

    try {
      if (nextState) {
        await api.post(`/api/music/artists/${track.artist_id}/follow`, {});
      } else {
        await api.delete(`/api/music/artists/${track.artist_id}/follow`);
      }
      onFollowToggled?.(track.artist_id, nextState);
    } catch {
      setIsFollowing(!nextState);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const shareUrl = `${window.location.origin}/music?track=${track.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id={`music-track-card-${track.id}`}
      className={`bg-white rounded-2xl p-3 sm:p-3.5 border transition-all duration-200 hover:shadow-lg flex flex-col justify-between group relative select-none ${
        isCurrent ? 'border-purple-600 ring-1 ring-purple-600 shadow-md' : 'border-gray-200'
      }`}
    >
      {/* Artwork Header */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-100 shadow-xs mb-3 group/cover flex items-center justify-center">
        {track.artwork_url ? (
          <img
            src={track.artwork_url}
            alt={track.title}
            className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 to-neutral-900 flex items-center justify-center">
            <Music2 className="w-12 h-12 text-purple-300/80" />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 z-10">
          {track.is_free ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full border border-emerald-300 shadow-xs">
              FREE
            </span>
          ) : (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50/95 backdrop-blur-xs px-2 py-0.5 rounded-full border border-amber-300 shadow-xs flex items-center gap-1">
              <ShoppingBag className="w-2.5 h-2.5" />
              <span>{track.price_rwf} RWF</span>
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
            aria-label="More track options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 text-xs font-semibold text-gray-700">
              <button
                type="button"
                onClick={handleShare}
                className="w-full px-3 py-2 text-left hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share song link</span>
              </button>
              {track.artist_id && (
                <Link
                  to={`/artist/${track.artist_id}`}
                  onClick={() => setShowMenu(false)}
                  className="w-full px-3 py-2 text-left hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span>View artist channel</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {track.audio_url && (
          <div
            onClick={handlePlayToggle}
            className={`absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-center justify-center transition-opacity cursor-pointer ${
              isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#FFB300] hover:bg-amber-400 text-black flex items-center justify-center shadow-xl active:scale-90 transition-all">
              {isThisPlaying ? (
                <Pause className="w-6 h-6 fill-black" />
              ) : (
                <Play className="w-6 h-6 fill-black ml-0.5" />
              )}
            </div>
          </div>
        )}

        {isThisPlaying && (
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFB300]" />
            <span>PLAYING</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1 mb-2.5">
        <div className="flex items-center justify-between gap-1 text-[11px] text-purple-700 font-bold uppercase tracking-wider">
          <span className="truncate">{track.genre}</span>
          {track.country_name && (
            <span className="text-gray-400 font-normal shrink-0">{track.country_name}</span>
          )}
        </div>

        <h3 className="text-sm font-bold text-gray-900 truncate leading-snug group-hover:text-purple-700 transition-colors">
          {track.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium pt-0.5">
          <span className="font-semibold text-gray-800">
            {(track.plays_count || 0).toLocaleString()} plays
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-gray-400" />
            {formatTime(track.duration_seconds)}
          </span>
        </div>
      </div>

      {/* Artist Footer */}
      <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
        <Link
          to={track.artist_id ? `/artist/${track.artist_id}` : '#'}
          className="flex items-center gap-2 min-w-0 flex-1 group/artist"
          title={`Visit ${track.artist_name} channel`}
        >
          <div className="relative shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-purple-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {track.artist_avatar ? (
              <img
                src={track.artist_avatar}
                alt={track.artist_name}
                className="w-full h-full object-cover group-hover/artist:scale-105 transition-transform"
              />
            ) : (
              <span>{track.artist_name.charAt(0).toUpperCase()}</span>
            )}
            {track.artist_verified && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-black text-white rounded-full flex items-center justify-center ring-1 ring-white">
                <CheckCircle2 className="w-2.5 h-2.5 fill-black text-white" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900 group-hover/artist:text-purple-700 truncate leading-tight">
              {track.artist_name}
            </p>
            <p className="text-[10px] text-gray-400 truncate">
              {typeof track.artist_followers === 'number' && track.artist_followers > 0
                ? `${track.artist_followers.toLocaleString()} followers`
                : 'Artist Channel'}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleLike}
            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${
              isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'
            }`}
            title="Like track"
            aria-label="Like track"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          {track.artist_id && (
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                isFollowing
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'bg-gray-900 hover:bg-black text-white shadow-xs'
              }`}
              title={isFollowing ? 'Following artist' : 'Follow artist'}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3 h-3" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {copied && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg z-30 font-medium">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
