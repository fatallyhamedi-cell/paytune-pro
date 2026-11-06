import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, Film, RefreshCw } from 'lucide-react';

export interface VideoPlayerProps {
  src?: string;
  videoId?: string;
  video?: {
    id?: string;
    title?: string;
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
  onOpenPaymentModal?: () => void;
  onRequestPhoneAccess?: () => void;
  onProgressUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  videoId,
  video,
  poster,
  savedProgress = 0,
  onOpenPaymentModal,
  onRequestPhoneAccess,
  onProgressUpdate,
  onEnded,
  onPlay
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [paywallTriggered, setPaywallTriggered] = useState(false);
  const isPaidNotOwned = Boolean(video && !video.is_free && !video.userOwns);

  // Determine effective media source URL
  const effectiveSrc =
    src ||
    video?.video_url ||
    video?.preview_url ||
    (video as any)?.audio_url ||
    '';

  const effectiveId = videoId || video?.id || '';
  const effectivePoster = poster || video?.thumbnail_url || '';

  console.log('[VideoPlayer] Initializing VideoPlayer. Video ID:', effectiveId, 'Source:', effectiveSrc, 'isPaidNotOwned:', isPaidNotOwned);

  // Reset paywall state if user owns the video now
  useEffect(() => {
    if (video?.userOwns) {
      setPaywallTriggered(false);
    }
  }, [video?.userOwns]);

  // Restore saved progress on loadedmetadata
  const handleLoadedMetadata = () => {
    if (videoRef.current && savedProgress > 0 && !isPaidNotOwned) {
      console.log(`[VideoPlayer] Restoring saved progress to ${savedProgress}s`);
      videoRef.current.currentTime = savedProgress;
    }
  };

  // Record view on play
  const handlePlay = async () => {
    console.log('[VideoPlayer] Video started playing. Source:', effectiveSrc);

    if (onPlay) {
      onPlay();
    }

    // Call backend view endpoint once per playback session
    if (!hasRecordedView && effectiveId) {
      setHasRecordedView(true);
      try {
        console.log(`[VideoPlayer] Calling POST /api/videos/${effectiveId}/view`);
        await axios.post(`/api/videos/${effectiveId}/view`);
      } catch (err: any) {
        console.warn('[VideoPlayer] View recording failed (non-blocking):', err?.message || err);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;

    // FEATURE: 30-Second Free Preview Paywall Enforcement
    if (isPaidNotOwned && current >= 30) {
      videoRef.current.pause();
      videoRef.current.currentTime = 30;
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
      setPaywallTriggered(false);
      videoRef.current.play().catch(() => {});
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = videoRef.current?.error;
    console.error('[VideoPlayer] Video playback error event:', error, 'Source:', effectiveSrc);
    setPlaybackError(
      error?.message ||
      'Unable to play video from storage. Please verify connection and CORS permissions.'
    );
  };

  // Fallback UI when video source is missing
  if (!effectiveSrc) {
    console.warn('[VideoPlayer] Video source is missing or empty.');
    return (
      <div
        id="video-player-fallback"
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center p-6 text-center text-neutral-300 shadow-xl"
      >
        <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mb-3 text-purple-600 shadow-md">
          <Film className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Video source unavailable</h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-4">
          The requested video media URL is not available or is currently processing.
        </p>
        {onOpenPaymentModal && video && !video.userOwns && !video.is_free && (
          <button
            onClick={onOpenPaymentModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-400 text-black font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            Unlock Full Video ({video.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : 'Buy Now'})
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      id="video-player-container"
      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex items-center justify-center group"
    >
      {/* Standard HTML5 Video Element with Controls and Anonymous CORS */}
      <video
        ref={videoRef}
        src={effectiveSrc}
        poster={effectivePoster}
        controls
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        onPlay={handlePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onError={handleError}
        className="w-full h-full object-contain bg-black focus:outline-none"
      >
        <source src={effectiveSrc} type="video/mp4" />
        <source src={effectiveSrc} type="video/webm" />
        Your browser does not support the HTML5 video tag.
      </video>

      {/* 30-SECOND PAYWALL PREVIEW OVERLAY */}
      {paywallTriggered && isPaidNotOwned && (
        <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-600/40 text-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-purple-600/10">
            <span className="text-2xl">🔒</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-600/15 text-purple-600 border border-purple-600/30 text-[11px] font-black uppercase tracking-wider mb-2">
            30-Second Preview Ended
          </span>
          <h3 className="text-lg sm:text-xl font-black text-white max-w-md leading-tight">
            Unlock Full Video Access
          </h3>
          <p className="text-xs text-neutral-300 max-w-sm mt-1.5 mb-5 leading-relaxed">
            Pay once, watch forever. Direct artist support with zero monthly subscriptions.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="paywall-overlay-unlock-btn"
              onClick={() => {
                if (onOpenPaymentModal) onOpenPaymentModal();
              }}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-400 text-black font-extrabold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              <span>Unlock for {video?.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : '$0.50'}</span>
            </button>
            <button
              onClick={handleReplayPreview}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all cursor-pointer border border-neutral-700 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replay 30s Preview</span>
            </button>
          </div>
        </div>
      )}

      {/* Playback Error Toast Overlay (if CORS / 403 / Network Issue Occurs) */}
      {playbackError && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertCircle className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
          <h4 className="text-sm font-bold text-white mb-1">Playback Issue</h4>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">{playbackError}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPlaybackError(null);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Playback
            </button>
            <a
              href={effectiveSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-400 text-black text-xs font-bold shadow-xs cursor-pointer"
            >
              Open Direct Stream
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
