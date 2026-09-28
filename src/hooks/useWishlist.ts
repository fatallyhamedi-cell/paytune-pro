import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { WishlistItem } from '../types/dashboard';
import { useAuth } from './useAuth';

export function useWishlist() {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/user/wishlist');
      setWishlist(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch wishlist:', err);
      setError(err.response?.data?.error || 'Failed to load Watch Later list');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (videoId: string) => {
    try {
      await axios.post(`/api/user/wishlist/${videoId}`);
      await fetchWishlist();
      return true;
    } catch (err: any) {
      console.error('Failed to add to wishlist:', err);
      return false;
    }
  };

  const removeFromWishlist = async (videoId: string) => {
    try {
      await axios.delete(`/api/user/wishlist/${videoId}`);
      setWishlist(prev => prev.filter(item => item.video_id !== videoId && item.id !== videoId));
      return true;
    } catch (err: any) {
      console.error('Failed to remove from wishlist:', err);
      return false;
    }
  };

  const isInWishlist = (videoId: string) => {
    return wishlist.some(item => item.video_id === videoId);
  };

  return {
    wishlist,
    loading,
    error,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist: fetchWishlist
  };
}
