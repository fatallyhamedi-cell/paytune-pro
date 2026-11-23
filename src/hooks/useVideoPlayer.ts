import { useState, useRef, useEffect, useCallback } from 'react';

interface UseVideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  initiallyMuted?: boolean;
  shouldLoad?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export function useVideoPlayer({
  src,
  autoPlay = false,
  loop = true,
  initiallyMuted = false,
  shouldLoad = true,
  onEnded,
  onTimeUpdate,
}: UseVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initiallyMuted);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const autoPlayRef = useRef(autoPlay);
  const loopRef = useRef(loop);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // Play video with browser policy tolerance
  const play = useCallback(async () => {
    if (!videoRef.current || !shouldLoad || !src) return;
    setPlaybackError(null);
    try {
      await videoRef.current.play();
      setIsPlaying(true);
      setIsBuffering(false);
    } catch (err: any) {
      // If unmuted playback was rejected by browser policy, fall back to muted
      if (err?.name === 'NotAllowedError' && videoRef.current && !videoRef.current.muted) {
        videoRef.current.muted = true;
        setIsMuted(true);
        try {
          await videoRef.current.play();
          setIsPlaying(true);
          setIsBuffering(false);
        } catch {
          setIsPlaying(false);
          setIsBuffering(false);
        }
      } else {
        setIsPlaying(false);
        setIsBuffering(false);
      }
    }
  }, [shouldLoad, src]);

  const pause = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, []);

  const setMuteState = useCallback((muted: boolean) => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
    setIsMuted(muted);
  }, []);

  const retryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackError(null);
    setIsBuffering(true);
    video.load();
    play();
  }, [play]);

  // Sync initiallyMuted when prop changes
  useEffect(() => {
    setIsMuted(initiallyMuted);
    if (videoRef.current) {
      videoRef.current.muted = initiallyMuted;
      videoRef.current.volume = 1.0;
    }
  }, [initiallyMuted]);

  // Reset buffering state cleanly when element is suspended outside active window
  useEffect(() => {
    if (!shouldLoad) {
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackError(null);
    }
  }, [shouldLoad]);

  // Attach stable listeners once per media source mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad || !src) return;

    setPlaybackError(null);
    video.muted = isMuted;
    video.volume = 1.0;

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setPlaybackError(null);
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handleLoadedData = () => {
      setPlaybackError(null);
      setIsBuffering(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsBuffering(false);
      if (autoPlayRef.current) {
        play();
      }
    };
    const handleTimeUpdate = () => {
      const curr = video.currentTime || 0;
      const dur = video.duration || 1;
      setCurrentTime(curr);
      setProgress((curr / dur) * 100);
      onTimeUpdateRef.current?.(curr, dur);
    };
    const handleVideoEnded = () => {
      if (loopRef.current) {
        video.currentTime = 0;
        play();
      }
      onEndedRef.current?.();
    };
    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setPlaybackError('Unable to stream this short right now.');
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleVideoEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleVideoEnded);
      video.removeEventListener('error', handleError);
    };
    // Intentionally keep listener lifecycle stable across renders/mute changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, shouldLoad, play]);

  return {
    videoRef,
    isPlaying,
    isMuted,
    progress,
    currentTime,
    duration,
    isBuffering,
    playbackError,
    play,
    pause,
    retryPlay,
    togglePlay,
    toggleMute,
    setMuteState,
  };
}
