import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface MasterPayment {
  id: string;
  user_name: string;
  user_id: string;
  video_title: string;
  video_id: string;
  artist_name: string;
  artist_id: string;
  amount_rwf: number;
  vat_rwf: number;
  artist_share_rwf: number;
  owner_share_rwf: number;
  method: string;
  country_code?: string;
  paid_currency?: string;
  paid_amount?: number;
  exchange_rate?: number;
  escrow_status?: string;
  status: string;
  date: string;
}

export const useMasterPayments = () => {
  const [payments, setPayments] = useState<MasterPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/payments", {
        headers,
        params: {
          method: methodFilter,
          from: dateFrom,
          to: dateTo
        }
      });
      if (res.data) {
        setPayments(res.data.payments || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("useMasterPayments error:", err);
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, methodFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const refundPayment = async (id: string) => {
    const headers = getHeaders();
    const res = await axios.post(`/api/master/payments/${id}/refund`, {}, { headers });
    fetchPayments();
    return res.data;
  };

  const exportCSV = async () => {
    const headers = getHeaders();
    const res = await axios.get("/api/master/payments/export", {
      headers,
      responseType: "blob"
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `paytune_payments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return {
    payments,
    total,
    loading,
    error,
    methodFilter,
    setMethodFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    refreshPayments: fetchPayments,
    refundPayment,
    exportCSV
  };
};
