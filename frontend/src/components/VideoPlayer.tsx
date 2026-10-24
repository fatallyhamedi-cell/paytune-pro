import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Film, AlertCircle, RefreshCw } from 'lucide-react';

export interface VideoPlayerProps {
  src?: string;
  videoId?: string;
  video?: {
    id?: string;
    title?: string;
    video_url?: string;
    preview_url?: string;
    thumbnail_url?: string;
    [key: string]: any;
  };
  poster?: string;
  savedProgress?: number;
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
  onProgressUpdate,
  onEnded,
  onPlay
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const effectiveSrc =
    src ||
    video?.video_url ||
    video?.preview_url ||
    '';

  const effectiveId = videoId || video?.id || '';
  const effectivePoster = poster || video?.thumbnail_url || '';

  console.log('[VideoPlayer] Initializing VideoPlayer. ID:', effectiveId, 'Source:', effectiveSrc);

  const handleLoadedMetadata = () => {
    if (videoRef.current && savedProgress > 0) {
      videoRef.current.currentTime = savedProgress;
    }
  };

  const handlePlay = async () => {
    console.log('[VideoPlayer] Video started playing. Source:', effectiveSrc);
    if (onPlay) onPlay();

    if (!hasRecordedView && effectiveId) {
      setHasRecordedView(true);
      try {
        console.log(`[VideoPlayer] Recording view: POST /api/videos/${effectiveId}/view`);
        await axios.post(`/api/videos/${effectiveId}/view`);
      } catch (err: any) {
        console.warn('[VideoPlayer] View recording failed:', err?.message || err);
      }
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = videoRef.current?.error;
    console.error('[VideoPlayer] Video playback error event:', error, 'Source:', effectiveSrc);
    setPlaybackError(error?.message || 'Unable to play video from storage.');
  };

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
        <p className="text-xs text-neutral-400 max-w-sm">
          The requested video media URL is not available or is currently processing.
        </p>
      </div>
    );
  }

  return (
    <div
      id="video-player-container"
      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex items-center justify-center group"
    >
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
        onTimeUpdate={() => {
          if (videoRef.current && onProgressUpdate) {
            onProgressUpdate(videoRef.current.currentTime);
          }
        }}
        onEnded={onEnded}
        onError={handleError}
        className="w-full h-full object-contain bg-black focus:outline-none"
      >
        <source src={effectiveSrc} type="video/mp4" />
        <source src={effectiveSrc} type="video/webm" />
        Your browser does not support the HTML5 video tag.
      </video>

      {playbackError && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertCircle className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
          <h4 className="text-sm font-bold text-white mb-1">Playback Issue</h4>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">{playbackError}</p>
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
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
