import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface MasterArtist {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
  profile_image: string;
  status: "approved" | "pending" | "blocked";
  is_verified: boolean;
  video_count: number;
  total_earnings: number;
  pending_balance: number;
  subscribers: number;
  join_date: string;
}

export const useMasterArtists = () => {
  const [artists, setArtists] = useState<MasterArtist[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("joined");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autoApproveActive, setAutoApproveActive] = useState<boolean>(false);

  const fetchArtists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/master/artists", {
        params: {
          status: statusFilter,
          search: searchQuery,
          sort: sortBy
        }
      });
      if (res.data) {
        setArtists(res.data.artists || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterArtists error:", err);
      setError(err.response?.data?.error || err.message || "Failed to load artists");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const approveArtist = async (id: string) => {
    const res = await api.put(`/api/master/artists/${id}/approve`, {});
    fetchArtists();
    return res.data;
  };

  const blockArtist = async (id: string) => {
    const res = await api.put(`/api/master/artists/${id}/block`, {});
    fetchArtists();
    return res.data;
  };

  const unblockArtist = async (id: string) => {
    const res = await api.put(`/api/master/artists/${id}/unblock`, {});
    fetchArtists();
    return res.data;
  };

  const deleteArtist = async (id: string) => {
    const res = await api.delete(`/api/master/artists/${id}`);
    fetchArtists();
    return res.data;
  };

  const impersonateArtist = async (id: string) => {
    const res = await api.post(`/api/master/artists/impersonate/${id}`, {});
    return res.data;
  };

  const bulkAction = async (action: "approve" | "block" | "delete") => {
    if (selectedIds.length === 0) return;
    const res = await api.post("/api/master/artists/bulk-action", { action, ids: selectedIds });
    setSelectedIds([]);
    fetchArtists();
    return res.data;
  };

  const toggleAutoApprove = async (approveExisting: boolean = false) => {
    const res = await api.put("/api/master/artists/toggle-auto-approve", { approve_existing: approveExisting });
    if (res.data) {
      setAutoApproveActive(res.data.auto_approve_artists);
      fetchArtists();
    }
    return res.data;
  };

  const toggleSelectArtist = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === artists.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(artists.map(a => a.id));
    }
  };

  return {
    artists,
    total,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedIds,
    toggleSelectArtist,
    selectAll,
    autoApproveActive,
    refreshArtists: fetchArtists,
    approveArtist,
    blockArtist,
    unblockArtist,
    deleteArtist,
    impersonateArtist,
    bulkAction,
    toggleAutoApprove
  };
};
