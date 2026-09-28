import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export type ChannelTabType = 'videos' | 'shorts' | 'playlists' | 'live' | 'membership' | 'about';
export type VideoSortType = 'newest' | 'most_popular' | 'oldest';

export function useChannelTabs(artistId: string | undefined, initialTab: ChannelTabType = 'videos') {
  const [activeTab, setActiveTab] = useState<ChannelTabType>(initialTab);
  const [sort, setSort] = useState<VideoSortType>('newest');
  
  const [data, setData] = useState<{
    videos: any[];
    shorts: any[];
    playlists: any[];
    live: any[];
    membership: any[];
  }>({
    videos: [],
    shorts: [],
    playlists: [],
    live: [],
    membership: []
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTabData = useCallback(async (tab: ChannelTabType, currentSort: VideoSortType) => {
    if (!artistId) return;
    if (tab === 'about') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tab === 'videos') {
        const res = await axios.get(`/api/artists/${artistId}/videos`, {
          params: { sort: currentSort, limit: 50 }
        });
        setData(prev => ({ ...prev, videos: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'shorts') {
        const res = await axios.get(`/api/artists/${artistId}/shorts`);
        setData(prev => ({ ...prev, shorts: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'playlists') {
        const res = await axios.get(`/api/artists/${artistId}/playlists`);
        setData(prev => ({ ...prev, playlists: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'live') {
        const res = await axios.get(`/api/artists/${artistId}/live`);
        setData(prev => ({ ...prev, live: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'membership') {
        const res = await axios.get(`/api/artists/${artistId}/membership`);
        setData(prev => ({ ...prev, membership: Array.isArray(res.data) ? res.data : [] }));
      }
    } catch (err: any) {
      console.error(`Error loading ${tab} tab:`, err);
      setError(`Failed to load ${tab}.`);
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    fetchTabData(activeTab, sort);
  }, [activeTab, sort, fetchTabData]);

  const handleSortChange = (newSort: VideoSortType) => {
    setSort(newSort);
  };

  return {
    activeTab,
    setActiveTab,
    sort,
    setSort: handleSortChange,
    tabData: data,
    loading,
    error,
    refetch: () => fetchTabData(activeTab, sort)
  };
}
