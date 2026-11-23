import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { AudioPlayerContext, MusicTrack } from '../hooks/useAudioPlayer';
import { emitMediaPlay, subscribeMediaPlay } from '../lib/playbackBus';

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBarVisible, setIsBarVisible] = useState<boolean>(false);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playLoggedRef = useRef<{ [trackId: string]: boolean }>({});

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Pause audio automatically whenever a Watch video or Short begins playing
  useEffect(() => {
    return subscribeMediaPlay(
      (detail) => detail.kind === 'audio',
      () => {
        setIsPlaying(false);
      }
    );
  }, []);

  // Handle Play / Pause commands
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      emitMediaPlay(`audio:${currentTrack.id}`, 'audio');
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio playback notice:', err);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  // Valid listening event registration (counts after 10 seconds of verified streaming)
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;

    const trackId = currentTrack.id;
    if (playLoggedRef.current[trackId]) return;

    if (currentTime >= 10) {
      playLoggedRef.current[trackId] = true;
      api.post(
        `/api/music/tracks/${trackId}/play`,
        { listened_seconds: Math.floor(currentTime) }
      ).catch(() => {});
    }
  }, [currentTime, currentTrack, isPlaying]);

  const playTrack = useCallback((track: MusicTrack, newQueue?: MusicTrack[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setIsPlaying(true);
    setIsBarVisible(true);
  }, []);

  const pauseTrack = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((prev) => !prev);
  }, [currentTrack]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const nextTrack = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) {
      // Pick first track in queue
      playTrack(queue[0]);
    } else {
      const nextIndex = (currentIndex + 1) % queue.length;
      playTrack(queue[nextIndex]);
    }
  }, [currentTrack, queue, playTrack]);

  const prevTrack = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex <= 0) {
      playTrack(queue[queue.length - 1]);
    } else {
      playTrack(queue[currentIndex - 1]);
    }
  }, [currentTrack, queue, playTrack]);

  const toggleLike = useCallback(async (trackId: string) => {
    const isLiked = likedTrackIds.has(trackId);
    const nextSet = new Set(likedTrackIds);

    if (isLiked) {
      nextSet.delete(trackId);
    } else {
      nextSet.add(trackId);
    }
    setLikedTrackIds(nextSet);

    try {
      if (isLiked) {
        await api.delete(`/api/music/tracks/${trackId}/like`);
      } else {
        await api.post(`/api/music/tracks/${trackId}/like`, {});
      }
    } catch {
      // Rollback on auth or network failure
      setLikedTrackIds(likedTrackIds);
    }
  }, [likedTrackIds]);

  const closePlayer = useCallback(() => {
    setIsPlaying(false);
    setIsBarVisible(false);
  }, []);

  const openPlayer = useCallback(() => {
    if (currentTrack) {
      setIsBarVisible(true);
    }
  }, [currentTrack]);

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isBarVisible,
        queue,
        likedTrackIds,
        playTrack,
        pauseTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        nextTrack,
        prevTrack,
        toggleLike,
        closePlayer,
        openPlayer,
      }}
    >
      {/* Hidden audio element persisted across all page navigation */}
      <audio
        ref={audioRef}
        src={currentTrack?.audio_url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={nextTrack}
        preload="metadata"
      />
      {children}
    </AudioPlayerContext.Provider>
  );
};
