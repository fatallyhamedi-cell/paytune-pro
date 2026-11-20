import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface MasterStats {
  total_users: number;
  total_artists: number;
  total_videos: number;
  total_purchases: number;
  total_revenue: number;
  total_volume: number;
  total_vat: number;
  pending_approvals: number;
  pending_withdrawals: number;
  auto_approve_artists: boolean;
  currency: string;
}

export interface RevenueData {
  period: string;
  labels: string[];
  values: number[];
  gross_values?: number[];
  total_revenue: number;
  currency: string;
}

export interface ActivityItem {
  id: string;
  type: "purchase" | "registration" | "upload" | "withdrawal";
  title: string;
  description: string;
  timestamp: string;
  badge: string;
  badgeColor: string;
}

export const useMasterStats = () => {
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topContent, setTopContent] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, revRes, actRes, topRes] = await Promise.allSettled([
        api.get("/api/master/stats"),
        api.get(`/api/master/revenue?period=${revenuePeriod}`),
        api.get("/api/master/activity"),
        api.get("/api/master/top-content")
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data);
      }
      if (revRes.status === "fulfilled") {
        setRevenue(revRes.value.data);
      }
      if (actRes.status === "fulfilled") {
        setActivities(actRes.value.data);
      }
      if (topRes.status === "fulfilled") {
        setTopContent(topRes.value.data);
      }
    } catch (err: any) {
      console.error("useMasterStats error:", err);
      setError(err.response?.data?.error || err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [revenuePeriod]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const changeRevenuePeriod = async (period: "day" | "week" | "month" | "year") => {
    setRevenuePeriod(period);
    try {
      const res = await api.get(`/api/master/revenue?period=${period}`);
      setRevenue(res.data);
    } catch (e) {
      console.error("Failed to update revenue period", e);
    }
  };

  return {
    stats,
    revenue,
    revenuePeriod,
    activities,
    topContent,
    loading,
    error,
    refreshStats: fetchStats,
    changeRevenuePeriod
  };
};
