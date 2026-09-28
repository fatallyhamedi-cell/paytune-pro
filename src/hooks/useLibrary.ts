import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LibraryVideo } from '../types/dashboard';
import { useAuth } from './useAuth';

export function useLibrary() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title' | 'artist'>('newest');
  const [category, setCategory] = useState<string>('all');
  const [artistFilter, setArtistFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 12;

  const fetchLibrary = useCallback(async () => {
    if (!user) {
      setVideos([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (searchQuery.trim()) {
        const res = await axios.get('/api/user/library/search', {
          params: { q: searchQuery }
        });
        setVideos(res.data.items || []);
        setTotal(res.data.total || 0);
      } else {
        const offset = (page - 1) * limit;
        const res = await axios.get('/api/user/library', {
          params: {
            limit,
            offset,
            sort,
            category: category !== 'all' ? category : undefined,
            artist: artistFilter !== 'all' ? artistFilter : undefined
          }
        });
        setVideos(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch library:', err);
      setError(err.response?.data?.error || 'Failed to load purchased library');
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, sort, category, artistFilter, page]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  return {
    videos,
    total,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    category,
    setCategory,
    artistFilter,
    setArtistFilter,
    page,
    setPage,
    limit,
    refreshLibrary: fetchLibrary
  };
}
