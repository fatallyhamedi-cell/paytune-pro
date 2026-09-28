import { useState, useRef, useEffect, useCallback } from 'react';

interface UseVideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  initiallyMuted?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export function useVideoPlayer({
  src,
  autoPlay = false,
  loop = true,
  initiallyMuted = false,
  onEnded,
  onTimeUpdate
}: UseVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initiallyMuted);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);

  // Play video with browser policy tolerance
  const play = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setIsPlaying(true);
      setIsBuffering(false);
    } catch (err: any) {
      // If unmuted playback was rejected by browser policy, fall back to muted
      if (err?.name === 'NotAllowedError' && !videoRef.current.muted) {
        videoRef.current.muted = true;
        setIsMuted(true);
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    }
  }, []);

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

  // Sync initiallyMuted when prop changes
  useEffect(() => {
    setIsMuted(initiallyMuted);
    if (videoRef.current) {
      videoRef.current.muted = initiallyMuted;
      videoRef.current.volume = 1.0;
    }
  }, [initiallyMuted]);

  // Sync state and attach video element listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.volume = 1.0;

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsBuffering(false);
      if (autoPlay) {
        play();
      }
    };
    const handleTimeUpdate = () => {
      if (!video) return;
      const curr = video.currentTime || 0;
      const dur = video.duration || 1;
      setCurrentTime(curr);
      setProgress((curr / dur) * 100);
      onTimeUpdate?.(curr, dur);
    };
    const handleVideoEnded = () => {
      if (loop) {
        video.currentTime = 0;
        play();
      }
      onEnded?.();
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleVideoEnded);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleVideoEnded);
    };
  }, [src, autoPlay, loop, isMuted, play, onEnded, onTimeUpdate]);

  return {
    videoRef,
    isPlaying,
    isMuted,
    progress,
    currentTime,
    duration,
    isBuffering,
    play,
    pause,
    togglePlay,
    toggleMute,
    setMuteState
  };
}
