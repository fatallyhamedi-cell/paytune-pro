import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface MasterLog {
  id: string;
  admin: string;
  action: string;
  target: string;
  ip: string;
  timestamp: string;
  details: string;
}

export const useMasterLogs = () => {
  const [logs, setLogs] = useState<MasterLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/master/logs", {
        params: {
          action: actionFilter,
          admin: adminFilter
        }
      });
      if (res.data) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterLogs error:", err);
      setError(err.response?.data?.error || err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, adminFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCSV = async () => {
    const res = await api.get("/api/master/logs/export", {
      responseType: "blob"
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `paytune_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return {
    logs,
    total,
    loading,
    error,
    actionFilter,
    setActionFilter,
    adminFilter,
    setAdminFilter,
    refreshLogs: fetchLogs,
    exportCSV
  };
};
