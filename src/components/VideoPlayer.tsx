import React, { useRef, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  Subtitles,
  PictureInPicture,
  AlertCircle,
  Film,
  RefreshCw,
  Crown,
  Flag,
  ChevronRight,
  Lock,
  Loader2,
} from 'lucide-react';

export interface VideoPlayerProps {
  src?: string;
  videoId?: string;
  video?: {
    id?: string;
    title?: string;
    artist_name?: string;
    video_url?: string;
    preview_url?: string;
    thumbnail_url?: string;
    duration?: number;
    userOwns?: boolean;
    is_free?: boolean;
    price_rwf?: number;
    [key: string]: any;
  };
  poster?: string;
  savedProgress?: number;
  hasNext?: boolean;
  onNext?: () => void;
  isSubscribed?: boolean;
  onToggleSubscribe?: () => void;
  onShare?: () => void;
  onOpenPaymentModal?: () => void;
  onRequestPhoneAccess?: () => void;
  onProgressUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  videoId,
  video,
  poster,
  savedProgress = 0,
  hasNext = false,
  onNext,
  isSubscribed = false,
  onToggleSubscribe,
  onShare,
  onOpenPaymentModal,
  onRequestPhoneAccess,
  onProgressUpdate,
  onEnded,
  onPlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(video?.duration || 0));
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [paywallTriggered, setPaywallTriggered] = useState(false);

  const isPaidNotOwned = Boolean(video && !video.is_free && !video.userOwns);
  const effectiveSrc =
    src ||
    video?.video_url ||
    video?.preview_url ||
    (video as any)?.audio_url ||
    '';

  const effectiveId = videoId || video?.id || '';
  const effectivePoster = poster || video?.thumbnail_url || '';

  // Reset states when video changes
  useEffect(() => {
    setHasRecordedView(false);
    setPlaybackError(null);
    setPaywallTriggered(false);
    setCurrentTime(0);
    setIsPlaying(false);
    setShowSettingsMenu(false);
  }, [effectiveId, effectiveSrc]);

  useEffect(() => {
    if (video?.userOwns) {
      setPaywallTriggered(false);
    }
  }, [video?.userOwns]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    if (isPlaying && !showSettingsMenu) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  }, [isPlaying, showSettingsMenu]);

  useEffect(() => {
    scheduleHideControls();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [isPlaying, showSettingsMenu, scheduleHideControls]);

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const total = Math.floor(secs);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const rem = total % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
    }
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (paywallTriggered && isPaidNotOwned) {
      if (onOpenPaymentModal) onOpenPaymentModal();
      return;
    }
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
    scheduleHideControls();
  }, [paywallTriggered, isPaidNotOwned, onOpenPaymentModal, scheduleHideControls]);

  const skip = useCallback(
    (delta: number) => {
      if (!videoRef.current) return;
      const maxSeek = isPaidNotOwned ? Math.min(29, duration || 29) : duration || videoRef.current.duration || 0;
      const target = Math.max(0, Math.min(maxSeek, videoRef.current.currentTime + delta));
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      scheduleHideControls();
    },
    [isPaidNotOwned, duration, scheduleHideControls]
  );

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.8);
      videoRef.current.volume = 0.8;
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    const target = containerRef.current || videoRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP not available on this browser
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettingsMenu(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawTime = Number(e.target.value);
    const cappedTime = isPaidNotOwned ? Math.min(29.5, rawTime) : rawTime;
    setCurrentTime(cappedTime);
    if (videoRef.current) {
      videoRef.current.currentTime = cappedTime;
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }
    if (savedProgress > 0 && !isPaidNotOwned) {
      videoRef.current.currentTime = savedProgress;
      setCurrentTime(savedProgress);
    }
  };

  const handlePlayEvent = async () => {
    setIsPlaying(true);
    setIsBuffering(false);
    if (onPlay) onPlay();

    if (!hasRecordedView && effectiveId) {
      setHasRecordedView(true);
      try {
        await api.post(`/api/videos/${effectiveId}/view`);
      } catch {
        // Non-blocking view telemetry
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    setCurrentTime(current);

    if (isPaidNotOwned && current >= 30) {
      videoRef.current.pause();
      videoRef.current.currentTime = 30;
      setIsPlaying(false);
      setPaywallTriggered(true);
      if (onOpenPaymentModal) {
        onOpenPaymentModal();
      }
      return;
    }

    if (onProgressUpdate) {
      onProgressUpdate(current);
    }
  };

  const handleReplayPreview = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setPaywallTriggered(false);
      videoRef.current.play().catch(() => {});
    }
  };

  const handleError = () => {
    const err = videoRef.current?.error;
    setPlaybackError(
      err?.message || 'Unable to stream video right now. Check connection and try again.'
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ([' ', 'k', 'K'].includes(e.key)) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      skip(-10);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      skip(10);
    } else if (e.key.toLowerCase() === 'm') {
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      toggleFullscreen();
    }
  };

  const remainingTime = Math.max(0, (duration || 0) - currentTime);

  if (!effectiveSrc) {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
        <div
          id="video-player-fallback"
          className="relative aspect-video w-full flex flex-col items-center justify-center p-6 text-center text-neutral-300"
        >
          <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mb-3 text-[#8B5CF6] shadow-md">
            <Film className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Video source unavailable</h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">
            The requested media stream URL is not available or is still processing.
          </p>
          {onOpenPaymentModal && video && !video.userOwns && !video.is_free && (
            <button
              type="button"
              onClick={onOpenPaymentModal}
              className="px-5 py-2.5 rounded-full bg-[#8B5CF6] hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Unlock Full Video ({video.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : 'Buy Now'})
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl">
      {/* MAIN VIDEO FRAME */}
      <div
        id="video-player-container"
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={scheduleHideControls}
        onMouseLeave={() => isPlaying && !showSettingsMenu && setShowControls(false)}
        className="relative aspect-video w-full bg-black flex items-center justify-center group focus:outline-none select-none"
      >
        <video
          ref={videoRef}
          src={effectiveSrc}
          poster={effectivePoster}
          crossOrigin="anonymous"
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onPlay={handlePlayEvent}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          onError={handleError}
          className={`w-full h-full object-contain bg-black cursor-pointer transition-all duration-300 ${
            paywallTriggered && isPaidNotOwned ? 'opacity-30 blur-sm' : ''
          }`}
        />

        {/* TOP-RIGHT OVERLAY PILL: Subscribe/Follow + Remaining Time + Share/Report */}
        <div
          className={`absolute top-3 right-3 md:top-4 md:right-4 z-20 flex items-center gap-2 transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center bg-black/75 backdrop-blur-md border border-white/15 rounded-lg overflow-hidden text-xs text-white shadow-lg">
            <button
              type="button"
              onClick={onToggleSubscribe}
              className={`px-3 py-1.5 font-bold transition-colors cursor-pointer ${
                isSubscribed
                  ? 'bg-white/15 text-purple-300 hover:bg-white/25'
                  : 'hover:bg-[#8B5CF6] text-white'
              }`}
            >
              {isSubscribed ? 'Following' : 'Follow'}
            </button>
            <div className="px-2.5 py-1.5 bg-white/10 font-mono text-[11px] flex items-center gap-1 text-neutral-200 border-l border-white/10">
              <span>{duration > 0 ? formatTime(remainingTime) : 'HD'}</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              title="Share / Report"
              className="p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white border border-white/15 backdrop-blur-md transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* PERMANENT PAYTUNE WATERMARK OVERLAY (Non-blocking above bottom controls) */}
        <div
          aria-hidden="true"
          className={`absolute bottom-16 right-4 md:right-6 z-20 pointer-events-none select-none flex items-center gap-1.5 transition-opacity duration-300 ${
            isPlaying ? 'opacity-50' : 'opacity-75'
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-sm bg-[#8B5CF6] shadow-md" />
          <span className="text-white font-black text-base md:text-lg tracking-wider drop-shadow-lg">
            PayTune
          </span>
        </div>

        {/* CENTER PLAY PROMPT OR BUFFERING INDICATOR */}
        {!paywallTriggered && !playbackError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            {isBuffering ? (
              <div className="p-3.5 rounded-full bg-black/65 backdrop-blur-md">
                <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
              </div>
            ) : !isPlaying ? (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play video"
                className="pointer-events-auto w-16 h-16 rounded-full bg-[#8B5CF6]/90 hover:bg-[#8B5CF6] text-white flex items-center justify-center shadow-2xl shadow-purple-600/40 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play className="w-7 h-7 fill-white ml-1" />
              </button>
            ) : null}
          </div>
        )}

        {/* CUSTOM BOTTOM CONTROL BAR */}
        {!paywallTriggered && !playbackError && (
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 sm:px-5 pb-3 pt-10 transition-opacity duration-300 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrubber Row */}
            <div className="flex items-center gap-3 mb-2.5">
              <input
                type="range"
                aria-label="Seek video timeline"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-[#8B5CF6]"
              />
              <span className="text-[11px] font-mono font-bold text-neutral-200 shrink-0 tabular-nums">
                -{formatTime(remainingTime)}
              </span>
            </div>

            {/* Action Controls Row */}
            <div className="flex items-center justify-between text-white">
              {/* Left Playback Cluster */}
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="hover:text-[#8B5CF6] transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                <button
                  type="button"
                  onClick={() => skip(-10)}
                  aria-label="Rewind 10 seconds"
                  className="hover:text-[#8B5CF6] transition-colors relative cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black">
                    10
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => skip(10)}
                  aria-label="Forward 10 seconds"
                  className="hover:text-[#8B5CF6] transition-colors relative cursor-pointer"
                >
                  <RotateCw className="w-5 h-5" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black">
                    10
                  </span>
                </button>

                {hasNext && onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    aria-label="Next video"
                    title="Up Next"
                    className="hover:text-[#8B5CF6] transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-5 h-5 fill-current" />
                  </button>
                )}

                <div className="flex items-center gap-2 group/volume">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="hover:text-[#8B5CF6] transition-colors cursor-pointer"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    aria-label="Volume"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setVolume(val);
                      setIsMuted(val === 0);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = val === 0;
                      }
                    }}
                    className="w-0 group-hover/volume:w-20 focus:w-20 transition-all duration-300 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-[#8B5CF6]"
                  />
                </div>

                <span className="hidden sm:inline text-xs text-neutral-300 font-mono tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Utilities Cluster */}
              <div className="flex items-center gap-3 sm:gap-4 relative">
                <button
                  type="button"
                  onClick={() => setCcEnabled((v) => !v)}
                  aria-label="Toggle Subtitles"
                  title={ccEnabled ? 'Subtitles On' : 'Subtitles Off'}
                  className={`transition-colors cursor-pointer ${
                    ccEnabled ? 'text-[#8B5CF6]' : 'text-white hover:text-[#8B5CF6]'
                  }`}
                >
                  <Subtitles className="w-5 h-5" />
                </button>

                {/* Playback Speed / Settings Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSettingsMenu((s) => !s)}
                    aria-label="Playback Settings"
                    title="Speed & Quality"
                    className={`transition-colors cursor-pointer flex items-center gap-1 ${
                      showSettingsMenu ? 'text-[#8B5CF6]' : 'hover:text-[#8B5CF6]'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                    {playbackRate !== 1 && (
                      <span className="text-[10px] font-bold text-[#8B5CF6]">{playbackRate}x</span>
                    )}
                  </button>

                  {showSettingsMenu && (
                    <div className="absolute bottom-9 right-0 w-44 rounded-xl bg-neutral-950/95 border border-neutral-800 shadow-2xl p-2 text-xs z-40">
                      <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                        Playback Speed
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {SPEED_OPTIONS.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleSpeedChange(rate)}
                            className={`py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                              playbackRate === rate
                                ? 'bg-[#8B5CF6] text-white'
                                : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={togglePictureInPicture}
                  aria-label="Picture in Picture"
                  title="Picture-in-Picture"
                  className="hover:text-[#8B5CF6] transition-colors cursor-pointer"
                >
                  <PictureInPicture className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  title="Fullscreen"
                  className="hover:text-[#8B5CF6] transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 30-SECOND PAYWALL PREVIEW LOCK OVERLAY */}
        {paywallTriggered && isPaidNotOwned && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#8B5CF6] flex items-center justify-center mb-3 shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <span className="px-3 py-1 rounded-full bg-[#8B5CF6]/20 text-purple-300 border border-[#8B5CF6]/40 text-[11px] font-black uppercase tracking-wider mb-2">
              30-Second Preview Ended
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white max-w-md leading-tight">
              Unlock Full Video Access
            </h3>
            <p className="text-xs text-neutral-300 max-w-sm mt-1.5 mb-5 leading-relaxed">
              Pay once, watch forever. 70% goes directly to {video?.artist_name || 'the creator'}.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="paywall-overlay-unlock-btn"
                type="button"
                onClick={() => onOpenPaymentModal?.()}
                className="px-6 py-2.5 rounded-full bg-[#8B5CF6] hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                Buy for {video?.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : '$0.50'}
              </button>
              {onRequestPhoneAccess && (
                <button
                  type="button"
                  onClick={onRequestPhoneAccess}
                  className="px-4 py-2.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-purple-300 text-xs font-semibold border border-[#8B5CF6]/40 cursor-pointer"
                >
                  Request Phone Approval
                </button>
              )}
              <button
                type="button"
                onClick={handleReplayPreview}
                className="px-4 py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all cursor-pointer border border-neutral-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replay Preview</span>
              </button>
            </div>
          </div>
        )}

        {/* PLAYBACK ERROR OVERLAY */}
        {playbackError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
            <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            <h4 className="text-sm font-bold text-white mb-1">Playback Issue</h4>
            <p className="text-xs text-neutral-400 max-w-sm mb-4">{playbackError}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlaybackError(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="px-3.5 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Playback
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ACCESS BANNER (Matching reference strip directly below the player when paid/unowned) */}
      {isPaidNotOwned && (
        <div
          id="video-paywall-strip"
          className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-gradient-to-r from-[#3B0764] via-[#581C87] to-[#2E1065] border-t border-purple-500/30 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold leading-tight">
                Unlock access to watch
              </p>
              <p className="text-[11px] text-purple-200/90">
                Available on PayTune Premium · {video?.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : '$0.50'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenPaymentModal?.()}
            className="px-6 py-2 rounded-full bg-white hover:bg-purple-100 text-neutral-950 font-black text-xs shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            Buy
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
