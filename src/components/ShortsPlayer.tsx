import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShortItem } from '../hooks/useShorts';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { ShortsOverlay } from './ShortsOverlay';
import { ShortsProgressBar } from './ShortsProgressBar';
import { ShortsLikeAnimation } from './ShortsLikeAnimation';
import { emitMediaPlay, subscribeMediaPlay } from '../lib/playbackBus';

interface ShortsPlayerProps {
  short: ShortItem;
  isActive: boolean;
  shouldLoadMedia?: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onSubscribe: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenTip?: () => void;
  onVideoCompleted?: () => void;
}

export const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  short,
  isActive,
  shouldLoadMedia = true,
  isMuted,
  onToggleMute,
  onLike,
  onSubscribe,
  onOpenComments,
  onOpenShare,
  onOpenTip,
  onVideoCompleted,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [heartPos, setHeartPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<'play' | 'pause' | null>(null);

  // Double tap detection
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    videoRef,
    isPlaying,
    progress,
    isBuffering,
    playbackError,
    play,
    pause,
    retryPlay,
    togglePlay,
  } = useVideoPlayer({
    src: shouldLoadMedia ? short.video_url : '',
    autoPlay: isActive,
    loop: true,
    initiallyMuted: isMuted,
    shouldLoad: shouldLoadMedia,
    onEnded: onVideoCompleted,
  });

  // Coordinate cross-media playback: pause this short if audio or Watch video starts
  useEffect(() => {
    return subscribeMediaPlay(`short:${short.id}`, () => {
      pause();
    });
  }, [short.id, pause]);

  // Broadcast active short playback so global audio pauses
  useEffect(() => {
    if (isActive && isPlaying) {
      emitMediaPlay(`short:${short.id}`, 'short');
    }
  }, [isActive, isPlaying, short.id]);

  // When active slide changes, automatically play or pause
  useEffect(() => {
    if (isActive && shouldLoadMedia) {
      play();
    } else {
      pause();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive, shouldLoadMedia, play, pause, videoRef]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // Handle tap / double-tap gesture
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (playbackError) return;
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        // Double tap!
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        lastTapRef.current = 0;

        // Calculate position of double tap for heart animation
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setHeartPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }
        setShowHeartAnimation(true);
        if (!short.is_liked) {
          onLike();
        }
      } else {
        // First tap
        lastTapRef.current = now;
        tapTimeoutRef.current = setTimeout(() => {
          // Toggle play/pause on single tap
          togglePlay();
          setShowPlayPauseIcon(isPlaying ? 'pause' : 'play');
          setTimeout(() => setShowPlayPauseIcon(null), 600);
        }, DOUBLE_TAP_DELAY);
      }
    },
    [playbackError, isPlaying, short.is_liked, onLike, togglePlay]
  );

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="relative w-full h-full max-w-[450px] aspect-[9/16] mx-auto bg-neutral-950 overflow-hidden select-none cursor-pointer flex items-center justify-center rounded-none sm:rounded-2xl sm:shadow-2xl border-0 sm:border sm:border-white/10"
    >
      {/* Sliding-window video mount: avoids saturating browser video decoders for far-away slides */}
      {shouldLoadMedia && short.video_url ? (
        <video
          ref={videoRef}
          src={short.video_url}
          poster={short.thumbnail_url || undefined}
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          loop
          muted={isMuted}
          preload={isActive ? 'auto' : 'metadata'}
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : short.thumbnail_url ? (
        <img
          src={short.thumbnail_url}
          alt={short.title}
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="w-full h-full bg-neutral-950 pointer-events-none" />
      )}

      {/* Permanent PayTune Watermark Overlay */}
      <div className="absolute top-4 right-4 z-20 pointer-events-none select-none flex items-center gap-1.5 opacity-60">
        <span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6] shadow-md" />
        <span className="text-white font-black text-sm tracking-wider drop-shadow-lg">
          PayTune
        </span>
      </div>

      {/* Video Overlay controls & metadata */}
      <ShortsOverlay
        short={short}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onLike={onLike}
        onSubscribe={onSubscribe}
        onOpenComments={onOpenComments}
        onOpenShare={onOpenShare}
        onOpenTip={onOpenTip}
      />

      {/* Thin Bottom Progress Bar */}
      <ShortsProgressBar progress={progress} />

      {/* Animated Heart Explosion on Double-tap */}
      <ShortsLikeAnimation
        show={showHeartAnimation}
        onAnimationComplete={() => setShowHeartAnimation(false)}
        x={heartPos?.x}
        y={heartPos?.y}
      />

      {/* Play/Pause Central Flash Indicator */}
      <AnimatePresence>
        {showPlayPauseIcon && !playbackError && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.9 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute z-30 w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white pointer-events-none"
          >
            {showPlayPauseIcon === 'play' ? (
              <Play className="w-8 h-8 fill-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-white" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Spinner */}
      {isBuffering && isActive && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-black/20 backdrop-blur-[2px]">
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        </div>
      )}

      {/* Playback Error + Retry Overlay */}
      {playbackError && isActive && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center"
        >
          <AlertCircle className="w-9 h-9 text-rose-400 mb-2" />
          <p className="text-sm font-bold text-white mb-1">Video playback failed</p>
          <p className="text-xs text-neutral-400 max-w-xs mb-4">{playbackError}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              retryPlay();
            }}
            className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ShortsPlayer;
