import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { FollowedArtist, FollowingVideo } from '../types/dashboard';
import { useAuth } from './useAuth';

export function useFollowing() {
  const { user } = useAuth();
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [feedVideos, setFeedVideos] = useState<FollowingVideo[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtists = useCallback(async () => {
    if (!user) {
      setArtists([]);
      setLoadingArtists(false);
      return;
    }

    try {
      setLoadingArtists(true);
      const res = await api.get('/api/user/following/artists');
      setArtists(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch followed artists:', err);
    } finally {
      setLoadingArtists(false);
    }
  }, [user]);

  const fetchFeed = useCallback(async () => {
    if (!user) {
      setFeedVideos([]);
      setLoadingFeed(false);
      return;
    }

    try {
      setLoadingFeed(true);
      const params: any = { limit: 30, offset: 0 };
      if (selectedArtistId) {
        params.artist_id = selectedArtistId;
      }
      const res = await api.get('/api/user/following', { params });
      setFeedVideos(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to fetch following feed:', err);
    } finally {
      setLoadingFeed(false);
    }
  }, [user, selectedArtistId]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const unfollowArtist = async (artistId: string) => {
    try {
      await api.post(`/api/artist/${artistId}/subscribe`);
      setArtists(prev => prev.filter(a => a.artist_id !== artistId && a.id !== artistId));
      setFeedVideos(prev => prev.filter(v => v.artist_id !== artistId));
      if (selectedArtistId === artistId) {
        setSelectedArtistId(null);
      }
      return true;
    } catch (err: any) {
      console.error('Failed to unfollow artist:', err);
      return false;
    }
  };

  return {
    artists,
    feedVideos,
    selectedArtistId,
    setSelectedArtistId,
    loadingArtists,
    loadingFeed,
    loading: loadingArtists || loadingFeed,
    error,
    unfollowArtist,
    refreshFollowing: async () => {
      await Promise.all([fetchArtists(), fetchFeed()]);
    }
  };
}
