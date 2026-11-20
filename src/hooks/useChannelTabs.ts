import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export type ChannelTabType = 'videos' | 'tracks' | 'shorts' | 'playlists' | 'live' | 'membership' | 'about';
export type VideoSortType = 'newest' | 'most_popular' | 'oldest';

export function useChannelTabs(artistId: string | undefined, initialTab: ChannelTabType = 'videos') {
  const [activeTab, setActiveTab] = useState<ChannelTabType>(initialTab);
  const [sort, setSort] = useState<VideoSortType>('newest');
  
  const [data, setData] = useState<{
    videos: any[];
    tracks: any[];
    shorts: any[];
    playlists: any[];
    live: any[];
    membership: any[];
  }>({
    videos: [],
    tracks: [],
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
        const res = await api.get(`/api/artists/${artistId}/videos`, {
          params: { sort: currentSort, limit: 50 }
        });
        setData(prev => ({ ...prev, videos: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'tracks') {
        const res = await api.get(`/api/artists/${artistId}/tracks`);
        const tracksList = res.data?.tracks || (Array.isArray(res.data) ? res.data : []);
        setData(prev => ({ ...prev, tracks: tracksList }));
      } else if (tab === 'shorts') {
        const res = await api.get(`/api/artists/${artistId}/shorts`);
        setData(prev => ({ ...prev, shorts: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'playlists') {
        const res = await api.get(`/api/artists/${artistId}/playlists`);
        setData(prev => ({ ...prev, playlists: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'live') {
        const res = await api.get(`/api/artists/${artistId}/live`);
        setData(prev => ({ ...prev, live: Array.isArray(res.data) ? res.data : [] }));
      } else if (tab === 'membership') {
        const res = await api.get(`/api/artists/${artistId}/membership`);
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
