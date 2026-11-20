import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

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

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/master/withdrawals", {
        params: { status: statusFilter }
      });
      if (res.data) {
        setWithdrawals(res.data.withdrawals || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterWithdrawals error:", err);
      setError(err.response?.data?.error || err.message || "Failed to load withdrawal requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const processWithdrawal = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await api.post(`/api/master/withdrawals/${id}/process`, {});
      fetchWithdrawals();
      return res.data;
    } finally {
      setProcessingId(null);
    }
  };

  const batchProcess = async () => {
    if (selectedIds.length === 0) return;
    const res = await api.post("/api/master/withdrawals/batch-process", { ids: selectedIds });
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
