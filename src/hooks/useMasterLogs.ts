import { useState, useEffect, useCallback } from "react";
import axios from "axios";

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

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/logs", {
        headers,
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
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, actionFilter, adminFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCSV = async () => {
    const headers = getHeaders();
    const res = await axios.get("/api/master/logs/export", {
      headers,
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
