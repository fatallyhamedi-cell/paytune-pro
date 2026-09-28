import { useState, useEffect, useCallback } from "react";
import axios from "axios";

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

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/videos", {
        headers,
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
      setError(err.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, visibilityFilter, typeFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const updateVideo = async (id: string, updates: Partial<MasterVideo>) => {
    const headers = getHeaders();
    const res = await axios.put(`/api/master/videos/${id}`, updates, { headers });
    fetchVideos();
    return res.data;
  };

  const deleteVideo = async (id: string) => {
    const headers = getHeaders();
    const res = await axios.delete(`/api/master/videos/${id}`, { headers });
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
