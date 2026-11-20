import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface MasterVideo {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  thumbnail_url: string;
  video_url: string;
  price_rwf: number;
  visibility: "public" | "unlisted" | "private";
  is_short: boolean;
  is_featured: boolean;
  views: number;
  likes: number;
  earnings: number;
  category: string;
  duration: number;
  uploaded_at: string;
}

export const useMasterVideos = () => {
  const [videos, setVideos] = useState<MasterVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("uploaded_at");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/master/videos", {
        params: {
          visibility: visibilityFilter,
          type: typeFilter,
          search: searchQuery,
          sort: sortBy
        }
      });
      if (res.data) {
        setVideos(res.data.videos || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterVideos error:", err);
      setError(err.response?.data?.error || err.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [visibilityFilter, typeFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const updateVideo = async (id: string, updates: Partial<MasterVideo>) => {
    const res = await api.put(`/api/master/videos/${id}`, updates);
    fetchVideos();
    return res.data;
  };

  const deleteVideo = async (id: string) => {
    const res = await api.delete(`/api/master/videos/${id}`);
    fetchVideos();
    return res.data;
  };

  const toggleSelectVideo = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return {
    videos,
    total,
    loading,
    error,
    visibilityFilter,
    setVisibilityFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedIds,
    toggleSelectVideo,
    refreshVideos: fetchVideos,
    updateVideo,
    deleteVideo
  };
};
