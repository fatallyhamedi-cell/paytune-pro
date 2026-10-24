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

  // Determine effective media source URL
  const effectiveSrc =
    src ||
    video?.video_url ||
    video?.preview_url ||
    (video as any)?.audio_url ||
    '';

  const effectiveId = videoId || video?.id || '';
  const effectivePoster = poster || video?.thumbnail_url || '';

  console.log('[VideoPlayer] Initializing VideoPlayer. Video ID:', effectiveId, 'Source:', effectiveSrc);

  // Restore saved progress on loadedmetadata
  const handleLoadedMetadata = () => {
    if (videoRef.current && savedProgress > 0) {
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
    if (videoRef.current && onProgressUpdate) {
      onProgressUpdate(videoRef.current.currentTime);
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
        <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mb-3 text-amber-500 shadow-md">
          <Film className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Video source unavailable</h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-4">
          The requested video media URL is not available or is currently processing.
        </p>
        {onOpenPaymentModal && video && !video.userOwns && !video.is_free && (
          <button
            onClick={onOpenPaymentModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            Unlock Full Video ({video.price_rwf ? `${video.price_rwf} RWF` : 'Buy Now'})
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
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-xs cursor-pointer"
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
