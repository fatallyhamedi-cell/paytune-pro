import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShortItem } from '../hooks/useShorts';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { ShortsOverlay } from './ShortsOverlay';
import { ShortsProgressBar } from './ShortsProgressBar';
import { ShortsLikeAnimation } from './ShortsLikeAnimation';

interface ShortsPlayerProps {
  short: ShortItem;
  isActive: boolean;
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
  isMuted,
  onToggleMute,
  onLike,
  onSubscribe,
  onOpenComments,
  onOpenShare,
  onOpenTip,
  onVideoCompleted
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [heartPos, setHeartPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<'play' | 'pause' | null>(null);

  // Double tap detection
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<any>(null);

  const {
    videoRef,
    isPlaying,
    progress,
    isBuffering,
    play,
    pause,
    togglePlay
  } = useVideoPlayer({
    src: short.video_url,
    autoPlay: isActive,
    loop: true,
    initiallyMuted: isMuted,
    onEnded: onVideoCompleted
  });

  // When active slide changes, automatically play or pause
  useEffect(() => {
    if (isActive) {
      play();
    } else {
      pause();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive, play, pause]);

  // Handle tap / double-tap gesture
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap!
      clearTimeout(tapTimeoutRef.current);
      lastTapRef.current = 0;

      // Calculate position of double tap for heart animation
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setHeartPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
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
  }, [isPlaying, short.is_liked, onLike, togglePlay]);

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="relative w-full h-full max-w-[450px] mx-auto bg-neutral-950 overflow-hidden select-none cursor-pointer flex items-center justify-center rounded-none sm:rounded-2xl sm:shadow-2xl border-0 sm:border sm:border-white/10"
      style={{ aspectRatio: '9/16' }}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={short.video_url || undefined}
        poster={short.thumbnail_url || undefined}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        loop
        muted={isMuted}
        preload={isActive ? "auto" : "metadata"}
        className="w-full h-full object-cover pointer-events-none"
      />

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
        {showPlayPauseIcon && (
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
      {isBuffering && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-black/20 backdrop-blur-[2px]">
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortsPlayer;
