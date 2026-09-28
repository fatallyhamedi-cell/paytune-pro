import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface MasterWithdrawal {
  id: string;
  artist_id: string;
  artist_name: string;
  amount: number;
  phone: string;
  provider: string;
  status: "pending" | "completed" | "failed";
  requested_at: string;
  completed_at?: string;
  transaction_ref?: string;
}

export const useMasterWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<MasterWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/withdrawals", {
        headers,
        params: { status: statusFilter }
      });
      if (res.data) {
        setWithdrawals(res.data.withdrawals || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterWithdrawals error:", err);
      setError(err.message || "Failed to load withdrawal requests");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const processWithdrawal = async (id: string) => {
    try {
      setProcessingId(id);
      const headers = getHeaders();
      const res = await axios.post(`/api/master/withdrawals/${id}/process`, {}, { headers });
      fetchWithdrawals();
      return res.data;
    } finally {
      setProcessingId(null);
    }
  };

  const batchProcess = async () => {
    if (selectedIds.length === 0) return;
    const headers = getHeaders();
    const res = await axios.post("/api/master/withdrawals/batch-process", { ids: selectedIds }, { headers });
    setSelectedIds([]);
    fetchWithdrawals();
    return res.data;
  };

  const toggleSelectWithdrawal = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllPending = () => {
    const pendingIds = withdrawals.filter(w => w.status === "pending").map(w => w.id);
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  return {
    withdrawals,
    total,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    selectedIds,
    processingId,
    toggleSelectWithdrawal,
    selectAllPending,
    refreshWithdrawals: fetchWithdrawals,
    processWithdrawal,
    batchProcess
  };
};
