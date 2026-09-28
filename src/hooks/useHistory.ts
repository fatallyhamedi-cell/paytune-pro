import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { WatchHistoryItem } from '../types/dashboard';
import { useAuth } from './useAuth';

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      setIsPaused(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/user/history', {
        params: { limit: 50, offset: 0 }
      });
      setHistory(res.data.items || []);
      setTotal(res.data.total || 0);
      setIsPaused(!!res.data.is_paused);
    } catch (err: any) {
      console.error('Failed to fetch watch history:', err);
      setError(err.response?.data?.error || 'Failed to load watch history');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const removeFromHistory = async (videoId: string) => {
    try {
      await axios.delete(`/api/user/history/${videoId}`);
      setHistory(prev => prev.filter(item => item.video_id !== videoId && item.id !== videoId));
      setTotal(prev => Math.max(0, prev - 1));
      return true;
    } catch (err: any) {
      console.error('Failed to remove history item:', err);
      return false;
    }
  };

  const clearAllHistory = async () => {
    try {
      await axios.delete('/api/user/history/clear');
      setHistory([]);
      setTotal(0);
      return true;
    } catch (err: any) {
      console.error('Failed to clear watch history:', err);
      return false;
    }
  };

  const togglePauseHistory = async () => {
    try {
      const res = await axios.post('/api/user/history/pause', { paused: !isPaused });
      setIsPaused(res.data.is_paused);
      return true;
    } catch (err: any) {
      console.error('Failed to toggle pause history:', err);
      return false;
    }
  };

  const filteredHistory = searchQuery.trim()
    ? history.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.artist_name && item.artist_name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : history;

  return {
    history: filteredHistory,
    rawHistory: history,
    total,
    isPaused,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    removeFromHistory,
    clearAllHistory,
    togglePauseHistory,
    refreshHistory: fetchHistory
  };
}
