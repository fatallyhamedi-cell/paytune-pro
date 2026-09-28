import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { VideoData } from './useVideo';

export * from './useVideo';

export interface UseVideosOptions {
  category?: string;
  search?: string;
  limit?: number;
  featured?: boolean;
}

export function useVideos(options?: UseVideosOptions) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (options?.category && options.category !== 'all') {
        params.append('category', options.category);
      }
      if (options?.search) {
        params.append('q', options.search);
      }
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }
      if (options?.featured) {
        params.append('featured', 'true');
      }

      const res = await api.get(`/api/videos?${params.toString()}`);
      setVideos(res.data?.videos || res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch videos:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  }, [options?.category, options?.search, options?.limit, options?.featured]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    loading,
    error,
    refetch: fetchVideos
  };
}

export default useVideos;
