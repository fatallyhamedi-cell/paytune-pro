import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  X,
  ChevronUp,
  ChevronDown,
  Disc,
  ShoppingBag,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

export default function MusicPlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isBarVisible,
    likedTrackIds,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleLike,
    closePlayer,
  } = useAudioPlayer();

  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isBarVisible || !currentTrack) return null;

  const isLiked = likedTrackIds.has(currentTrack.id);
  const progressPercent = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleShare = () => {
    const url = `${window.location.origin}/music?track=${currentTrack.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  return (
    <div
      id="paytune-persistent-player"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl transition-all duration-300 select-none"
    >
      {/* Top micro progress line for continuous scrubber feedback */}
      <div className="relative w-full h-1 bg-gray-100 cursor-pointer group overflow-hidden">
        <progress
          value={progressPercent}
          max={100}
          className="block w-full h-full appearance-none [&::-webkit-progress-bar]:bg-gray-100 [&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-purple-600 [&::-webkit-progress-value]:to-[#FFB300] [&::-moz-progress-bar]:bg-purple-600"
          aria-label="Playback progress"
        />
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Audio scrubber"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Track Information & Artist channel link */}
        <div className="flex items-center gap-3 min-w-0 w-1/3 sm:w-1/4">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm border border-gray-200 bg-gray-100 group">
            <img
              src={currentTrack.artwork_url}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <Disc className="w-5 h-5 text-[#FFB300] animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-900 truncate leading-tight">
              {currentTrack.title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 truncate">
              {currentTrack.artist_id ? (
                <Link
                  to={`/artist/${currentTrack.artist_id}`}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline truncate"
                >
                  {currentTrack.artist_name}
                </Link>
              ) : (
                <span className="text-xs font-semibold text-gray-600 truncate">
                  {currentTrack.artist_name}
                </span>
              )}
              {currentTrack.genre && (
                <>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="text-[11px] text-gray-400 truncate">{currentTrack.genre}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleLike(currentTrack.id)}
            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0 ${
              isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'
            }`}
            aria-label="Like track"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center: Playback Controls & Scrubber */}
        <div className="flex-1 max-w-xl flex flex-col items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Previous track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[#8B5CF6] hover:bg-purple-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 w-full mt-1">
            <span className="text-[11px] font-mono text-gray-500 w-9 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer overflow-hidden">
              <progress
                value={progressPercent}
                max={100}
                className="block w-full h-full appearance-none [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-[#8B5CF6] [&::-moz-progress-bar]:bg-[#8B5CF6]"
                aria-label="Track seek progress"
              />
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek track"
              />
            </div>
            <span className="text-[11px] font-mono text-gray-500 w-9 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume, Share, Price, and Close */}
        <div className="flex items-center justify-end gap-3 w-1/3 sm:w-1/4">
          {/* Lifetime access or free badge */}
          {currentTrack.is_free ? (
            <span className="hidden md:inline-flex text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Free Stream
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              <ShoppingBag className="w-3 h-3" />
              <span>{currentTrack.price_rwf} RWF</span>
            </span>
          )}

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors relative"
            title="Share track"
          >
            <Share2 className="w-4 h-4" />
            {copyFeedback && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                Link copied!
              </span>
            )}
          </button>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              className="text-gray-500 hover:text-gray-900"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 accent-purple-600 h-1 bg-gray-200 rounded cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {/* Close Player */}
          <button
            type="button"
            onClick={closePlayer}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Close player"
            aria-label="Close player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
