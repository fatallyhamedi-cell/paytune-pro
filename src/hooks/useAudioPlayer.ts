import { createContext, useContext } from 'react';

export interface MusicTrack {
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  artist_avatar?: string;
  artist_verified?: boolean;
  artist_followers?: number;
  album_title?: string;
  genre: string;
  duration_seconds: number;
  artwork_url: string;
  audio_url: string;
  is_free: boolean;
  price_rwf: number;
  plays_count: number;
  likes_count: number;
  release_year?: number;
  country_name?: string;
  country_code?: string;
}

export interface AudioPlayerContextType {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBarVisible: boolean;
  queue: MusicTrack[];
  likedTrackIds: Set<string>;
  playTrack: (track: MusicTrack, newQueue?: MusicTrack[]) => void;
  pauseTrack: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLike: (trackId: string) => Promise<void>;
  closePlayer: () => void;
  openPlayer: () => void;
}

export const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
