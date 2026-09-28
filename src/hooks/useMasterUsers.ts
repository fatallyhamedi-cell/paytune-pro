import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface MasterUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: "active" | "blocked";
  total_spent: number;
  purchases_count: number;
  join_date: string;
}

export const useMasterUsers = () => {
  const [users, setUsers] = useState<MasterUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("joined");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/users", {
        headers,
        params: {
          status: statusFilter,
          search: searchQuery,
          sort: sortBy
        }
      });
      if (res.data) {
        setUsers(res.data.users || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterUsers error:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, statusFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const blockUser = async (id: string) => {
    const headers = getHeaders();
    const res = await axios.put(`/api/master/users/${id}/block`, {}, { headers });
    fetchUsers();
    return res.data;
  };

  const unblockUser = async (id: string) => {
    const headers = getHeaders();
    const res = await axios.put(`/api/master/users/${id}/unblock`, {}, { headers });
    fetchUsers();
    return res.data;
  };

  const deleteUser = async (id: string) => {
    const headers = getHeaders();
    const res = await axios.delete(`/api/master/users/${id}`, { headers });
    fetchUsers();
    return res.data;
  };

  const toggleSelectUser = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return {
    users,
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
    toggleSelectUser,
    refreshUsers: fetchUsers,
    blockUser,
    unblockUser,
    deleteUser
  };
};
