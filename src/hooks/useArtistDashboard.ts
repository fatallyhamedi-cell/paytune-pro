import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './useAuth';

export interface DashboardSummary {
  total_earnings: number;
  current_balance: number;
  pending_balance: number;
  total_views: number;
  subscriber_count: number;
  video_count: number;
}

export function useArtistDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt primary studio dashboard endpoint
      const res = await axios.get('/api/artist/dashboard');
      setData(res.data);
    } catch (err: any) {
      console.warn('Primary artist dashboard fetch failed, attempting fallback...', err);
      // Attempt fallback with user id if available
      if (user?.id) {
        try {
          const fallbackRes = await axios.get(`/api/artist/${user.id}/dashboard`);
          setData(fallbackRes.data);
          return;
        } catch {
          // ignore
        }
      }
      setError(err.response?.data?.error || err.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const hideComment = async (commentId: string, hidden: boolean) => {
    try {
      await axios.put(`/api/artist/comments/${commentId}/hide`, { hidden });
      return { success: true };
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update comment visibility');
    }
  };

  const regenerateVideoLink = async (videoId: string) => {
    try {
      const res = await axios.post(`/api/artist/video/${videoId}/regenerate-link`);
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to regenerate stream link');
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      const res = await axios.delete(`/api/artist/video/${videoId}`);
      await fetchDashboard();
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete video');
    }
  };

  return {
    dashboardData: data,
    artist: data?.artist,
    summary: data?.summary,
    videos: data?.videos || [],
    earningsGraph: data?.earningsGraph,
    recentActivity: data?.recentActivity || [],
    withdrawals: data?.withdrawals || [],
    loading,
    error,
    refresh: fetchDashboard,
    hideComment,
    regenerateVideoLink,
    deleteVideo
  };
}
