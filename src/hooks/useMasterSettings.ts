import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface MasterPlatformSettings {
  platform_name: string;
  tagline?: string;
  logo_url?: string;
  vat_percentage: number;
  commission_percentage: number;
  owner_commission_percentage?: number;
  min_withdrawal: number;
  min_withdrawal_amount?: number;
  momo_number: string;
  owner_momo_number?: string;
  trending_days: number;
  maintenance_mode: boolean;
  maintenance_message?: string;
  auto_approve_artists: boolean;
  welcome_template: string;
  receipt_template: string;
  gift_template?: string;
  withdrawal_template?: string;
}

export const useMasterSettings = () => {
  const [settings, setSettings] = useState<MasterPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getHeaders();
      const res = await axios.get("/api/master/settings", { headers });
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err: any) {
      console.error("useMasterSettings error:", err);
      setError(err.message || "Failed to load platform settings");
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updated: Partial<MasterPlatformSettings>) => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      const headers = getHeaders();
      const res = await axios.put("/api/master/settings", updated, { headers });
      if (res.data && res.data.settings) {
        setSettings(res.data.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
      return res.data;
    } catch (err: any) {
      setError(err.message || "Failed to update platform settings");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const updateTemplates = async (templates: {
    welcome_template?: string;
    receipt_template?: string;
    gift_template?: string;
    withdrawal_template?: string;
  }) => {
    try {
      setSaving(true);
      const headers = getHeaders();
      const res = await axios.put("/api/master/settings/email-templates", templates, { headers });
      if (res.data && res.data.settings) {
        setSettings(res.data.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
      return res.data;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    error,
    saveSuccess,
    refreshSettings: fetchSettings,
    updateSettings,
    updateTemplates
  };
};
