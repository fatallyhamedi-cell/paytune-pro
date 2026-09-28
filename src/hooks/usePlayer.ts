import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

interface UsePlayerProps {
  src: string;
  userOwns: boolean;
  savedProgress?: number;
  onProgressUpdate?: (seconds: number) => void;
  onEnded?: () => void;
}

export function usePlayer({
  src,
  userOwns,
  savedProgress = 0,
  onProgressUpdate,
  onEnded
}: UsePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [isPaywallTriggered, setIsPaywallTriggered] = useState(false);
  const [quality, setQuality] = useState("Auto");
  const [qualities, setQualities] = useState<string[]>(["Auto", "1080p", "720p", "480p", "360p"]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Resume prompt detection
  useEffect(() => {
    if (savedProgress && savedProgress > 10 && userOwns) {
      setShowResumePrompt(true);
    } else {
      setShowResumePrompt(false);
    }
  }, [savedProgress, userOwns]);

  // Automatic video unlock when userOwns changes to true
  useEffect(() => {
    if (userOwns) {
      setIsPaywallTriggered(false);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [userOwns]);

  // HLS stream setup or native fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Reset states on src change
    setIsPlaying(false);
    setCurrentTime(0);
    setIsPaywallTriggered(false);

    if (Hls.isSupported() && (src.includes('.m3u8') || src.includes('stream') || src.includes('hls'))) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = data.levels.map(l => `${l.height}p`);
        if (levels.length > 0) {
          setQualities(["Auto", ...new Set(levels)]);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (hls.autoLevelEnabled) {
          setQuality("Auto");
        } else {
          setQuality(`${hls.levels[data.level]?.height}p`);
        }
      });

      return () => {
        hls.destroy();
      };
    } else {
      // Native HTML5 Video playback (MP4/WebM or Safari HLS)
      video.src = src;
    }

    // Ensure video plays with sound by default (never muted)
    video.muted = false;
    video.volume = volume || 1;
    setIsMuted(false);
  }, [src, volume]);

  // Periodic watch progress persistence
  useEffect(() => {
    if (!isPlaying || !onProgressUpdate) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        onProgressUpdate(Math.floor(videoRef.current.currentTime));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, onProgressUpdate]);

  // Native Picture-in-Picture event listeners to avoid unknown React event handler warnings
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, []);

  // Video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setCurrentTime(current);

    // 30-Second Preview Limit for Unowned Videos
    if (!userOwns && current >= 30) {
      video.pause();
      video.currentTime = 30;
      setIsPlaying(false);
      setIsPaywallTriggered(true);
      return;
    }

    // Buffer calculation
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const dur = video.duration || 1;
      setBuffered(Math.min(100, (bufferedEnd / dur) * 100));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  };

  // Controls API
  const play = useCallback(async () => {
    if (isPaywallTriggered && !userOwns) return;
    try {
      await videoRef.current?.play();
      setIsPlaying(true);
    } catch (err) {
      console.debug("Play prevented or waiting for interaction:", err);
    }
  }, [isPaywallTriggered, userOwns]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Enforce 30s paywall boundary for unpaid videos
    let targetTime = Math.max(0, Math.min(time, duration || 0));
    if (!userOwns && targetTime >= 30) {
      targetTime = 30;
      video.currentTime = 30;
      pause();
      setIsPaywallTriggered(true);
      return;
    }

    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  }, [duration, userOwns, pause]);

  const changeVolume = useCallback((newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 0.5;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const changeSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error("Fullscreen error:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error("Exit fullscreen error:", err);
      }
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        // Video must have loaded metadata (readyState >= 1) before requesting Picture-in-Picture
        if (video.readyState < 1) {
          await new Promise<void>((resolve, reject) => {
            const onMetadata = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error("Video metadata failed to load."));
            };
            const timer = setTimeout(() => {
              cleanup();
              reject(new Error("Timeout waiting for video metadata before PiP."));
            }, 3000);
            const cleanup = () => {
              clearTimeout(timer);
              video.removeEventListener("loadedmetadata", onMetadata);
              video.removeEventListener("error", onError);
            };

            video.addEventListener("loadedmetadata", onMetadata, { once: true });
            video.addEventListener("error", onError, { once: true });
          });
        }

        if (video.readyState >= 1) {
          try {
            await video.requestPictureInPicture();
            setIsPiP(true);
          } catch (pipErr: any) {
            console.warn("PiP request skipped:", pipErr?.message || pipErr);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        console.warn("Cannot enter Picture-in-Picture: Video metadata is not loaded yet.");
      } else if (err?.name !== "AbortError") {
        console.warn("Picture-in-Picture warning:", err?.message || err);
      }
    }
  }, []);

  const changeQuality = useCallback((chosenQuality: string) => {
    setQuality(chosenQuality);
    if (!hlsRef.current) return;

    if (chosenQuality === "Auto") {
      hlsRef.current.currentLevel = -1; // Auto
    } else {
      const height = parseInt(chosenQuality, 10);
      const levelIndex = hlsRef.current.levels.findIndex(l => l.height === height);
      if (levelIndex !== -1) {
        hlsRef.current.currentLevel = levelIndex;
      }
    }
  }, []);

  // Post-purchase continuation
  const resumeAfterPurchase = useCallback(() => {
    setIsPaywallTriggered(false);
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = volume || 1;
      setIsMuted(false);
      video.currentTime = 30;
      video.play().catch(e => console.debug("Auto-resume play failed:", e));
      setIsPlaying(true);
    }
  }, [volume]);

  // Continue watching prompt handlers
  const resumeFromSavedProgress = useCallback(() => {
    setShowResumePrompt(false);
    if (savedProgress) {
      seek(savedProgress);
      play();
    }
  }, [savedProgress, seek, play]);

  const dismissResumePrompt = useCallback(() => {
    setShowResumePrompt(false);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard shortcuts (Space, J, L, Arrow keys, M, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs, textareas, etc.
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'k':
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'j': // rewind 10s
          e.preventDefault();
          seek(currentTime - 10);
          break;
        case 'l': // forward 10s
          e.preventDefault();
          seek(currentTime + 10);
          break;
        case 'arrowleft': // rewind 5s
          e.preventDefault();
          seek(currentTime - 5);
          break;
        case 'arrowright': // forward 5s
          e.preventDefault();
          seek(currentTime + 5);
          break;
        case 'arrowup': // volume up 10%
          e.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case 'arrowdown': // volume down 10%
          e.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case 'm': // mute toggle
          e.preventDefault();
          toggleMute();
          break;
        case 'f': // fullscreen toggle
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, currentTime, changeVolume, volume, toggleMute, toggleFullscreen]);

  return {
    videoRef,
    containerRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isFullscreen,
    isPiP,
    buffered,
    isPaywallTriggered,
    quality,
    qualities,
    showResumePrompt,
    // Event bindings for <video>
    videoProps: {
      ref: videoRef,
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onPlay: handlePlay,
      onPause: handlePause,
      onEnded: handleEnded,
      playsInline: true,
      controls: false,
      preload: "metadata",
      crossOrigin: "anonymous" as const
    },
    // Controls
    play,
    pause,
    togglePlay,
    seek,
    changeVolume,
    toggleMute,
    changeSpeed,
    toggleFullscreen,
    togglePiP,
    changeQuality,
    resumeAfterPurchase,
    resumeFromSavedProgress,
    dismissResumePrompt
  };
}
