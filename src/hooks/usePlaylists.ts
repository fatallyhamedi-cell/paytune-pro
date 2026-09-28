import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Playlist } from '../types/dashboard';
import { useAuth } from './useAuth';

export function usePlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/user/playlists');
      setPlaylists(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch playlists:', err);
      setError(err.response?.data?.error || 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const createPlaylist = async (name: string, description?: string, is_public = true) => {
    try {
      const res = await axios.post('/api/user/playlists', {
        name,
        title: name,
        description,
        is_public
      });
      const created = res.data.playlist || res.data;
      setPlaylists(prev => [created, ...prev]);
      return created;
    } catch (err: any) {
      console.error('Failed to create playlist:', err);
      throw new Error(err.response?.data?.error || 'Failed to create playlist');
    }
  };

  const updatePlaylist = async (id: string, data: { name?: string; title?: string; description?: string; is_public?: boolean }) => {
    try {
      const res = await axios.put(`/api/user/playlists/${id}`, data);
      const updated = res.data.playlist;
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      return true;
    } catch (err: any) {
      console.error('Failed to update playlist:', err);
      throw new Error(err.response?.data?.error || 'Failed to update playlist');
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      await axios.delete(`/api/user/playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      return true;
    } catch (err: any) {
      console.error('Failed to delete playlist:', err);
      throw new Error(err.response?.data?.error || 'Failed to delete playlist');
    }
  };

  const addVideoToPlaylist = async (playlistId: string, videoId: string) => {
    try {
      const res = await axios.post(`/api/user/playlists/${playlistId}/videos`, { videoId });
      await fetchPlaylists();
      return { success: true, alreadyIn: !!res.data.alreadyIn };
    } catch (err: any) {
      console.error('Failed to add video to playlist:', err);
      throw new Error(err.response?.data?.error || 'Failed to add video to playlist');
    }
  };

  const removeVideoFromPlaylist = async (playlistId: string, videoId: string) => {
    try {
      await axios.delete(`/api/user/playlists/${playlistId}/videos/${videoId}`);
      setPlaylists(prev => prev.map(p => {
        if (p.id === playlistId) {
          const filtered = (p.videos || []).filter(v => v.id !== videoId);
          return { ...p, videos: filtered, video_count: filtered.length };
        }
        return p;
      }));
      return true;
    } catch (err: any) {
      console.error('Failed to remove video from playlist:', err);
      return false;
    }
  };

  const reorderVideos = async (playlistId: string, videoIds: string[]) => {
    try {
      await axios.put(`/api/user/playlists/${playlistId}/reorder`, { videoIds });
      await fetchPlaylists();
      return true;
    } catch (err: any) {
      console.error('Failed to reorder videos:', err);
      return false;
    }
  };

  const getShareLink = async (playlistId: string) => {
    try {
      const res = await axios.get(`/api/user/playlists/${playlistId}/share`);
      return res.data.shareUrl;
    } catch (err: any) {
      return `${window.location.origin}/playlist/${playlistId}`;
    }
  };

  return {
    playlists,
    loading,
    error,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    reorderVideos,
    getShareLink,
    refreshPlaylists: fetchPlaylists
  };
}
