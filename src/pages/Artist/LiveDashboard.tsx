import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Plus,
  Video,
  Radio,
  Users,
  DollarSign,
  MessageSquare,
  Sparkles,
  Key,
  ExternalLink,
  CheckCircle,
  Clock,
  Trash2,
  TrendingUp,
  Activity,
  Copy,
  Check,
  RefreshCw,
  ShieldOff,
  AlertCircle,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";

interface PendingStreamAction {
  type: "end" | "delete" | "rotate_key" | "revoke_key";
  streamId: string;
  label: string;
}

export default function LiveDashboard() {
  const { user } = useAuth();
  const [streams, setStreams] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingStreamAction | null>(null);

  // Form states
  const [createModal, setCreateModal] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");
  const [formIsPaid, setFormIsPaid] = useState<boolean>(false);
  const [formPriceRwf, setFormPriceRwf] = useState<string>("1000");
  const [formPriceUsd, setFormPriceUsd] = useState<string>("1.00");
  const [formScheduled, setFormScheduled] = useState<string>("");
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Selected stream, single-display newly issued secret key, & stats
  const [selectedStream, setSelectedStream] = useState<any>(null);
  const [issuedKeyOnce, setIssuedKeyOnce] = useState<string | null>(null);
  const [streamAnalytics, setStreamAnalytics] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    fetchArtistStreams();
  }, [statusFilter, user?.id]);

  const getAuthToken = () => {
    try {
      return localStorage.getItem("paytune_auth_token") || localStorage.getItem("token");
    } catch {
      return null;
    }
  };

  const notify = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 5000);
  };

  const fetchArtistStreams = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url =
        statusFilter === "all"
          ? "/api/artist/live"
          : `/api/artist/live?status=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Could not load your broadcasts from PostgreSQL.");
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setStreams(rows);

      if (rows.length > 0) {
        const found = rows.find((s: any) => s.id === selectedStream?.id);
        const toSelect = found || rows[0];
        setSelectedStream(toSelect);
        fetchStreamStats(toSelect.id);
      } else {
        setSelectedStream(null);
        setStreamAnalytics(null);
      }

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load broadcast list.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamStats = async (id: string) => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/artist/live/${id}/analytics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStreamAnalytics(data);
      }
    } catch (err) {
      console.error("Error loading stream analytics", err);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setFormLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/artist/live/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDesc,
          is_paid: formIsPaid,
          price_rwf: formIsPaid ? Number(formPriceRwf) : null,
          price_usd: formIsPaid ? Number(formPriceUsd) : null,
          scheduled_start: formScheduled || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create broadcast.");
      }

      setCreateModal(false);
      setFormTitle("");
      setFormDesc("");
      setFormIsPaid(false);
      setFormPriceRwf("1000");
      setFormPriceUsd("1.00");
      setFormScheduled("");

      if (data.stream_key_once) {
        setIssuedKeyOnce(data.stream_key_once);
      }
      await fetchArtistStreams();
      if (data.stream) {
        setSelectedStream(data.stream);
        fetchStreamStats(data.stream.id);
      }
      notify("success", "Broadcast created. Save your newly generated stream key before leaving.");
    } catch (err: any) {
      notify("error", err.message || "Error creating broadcast.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleStartStream = async (id: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/artist/live/${id}/start`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const updated = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(updated.error || "Could not transition stream to live.");

      setSelectedStream(updated.stream);
      fetchArtistStreams();
      fetchStreamStats(id);
      notify("success", "Broadcast is now live.");
    } catch (err: any) {
      notify("error", err.message || "Failed to start stream.");
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { type, streamId } = pendingAction;
    setPendingAction(null);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      if (type === "end") {
        const res = await fetch(`/api/artist/live/${streamId}/end`, {
          method: "PUT",
          headers,
        });
        const updated = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(updated.error || "Failed to end broadcast.");
        setSelectedStream(updated.stream);
        await fetchArtistStreams();
        await fetchStreamStats(streamId);
        notify("success", "Broadcast ended and archived.");
      } else if (type === "delete") {
        const res = await fetch(`/api/artist/live/${streamId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to delete broadcast.");
        }
        setIssuedKeyOnce(null);
        await fetchArtistStreams();
        notify("success", "Broadcast removed.");
      } else if (type === "rotate_key") {
        const res = await fetch(`/api/artist/live/${streamId}/key/rotate`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to rotate stream key.");
        setIssuedKeyOnce(data.stream_key_once || null);
        await fetchArtistStreams();
        notify("success", "New stream key issued. Copy it now—it will not be shown again.");
      } else if (type === "revoke_key") {
        const res = await fetch(`/api/artist/live/${streamId}/key/revoke`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to revoke stream key.");
        setIssuedKeyOnce(null);
        await fetchArtistStreams();
        notify("success", "Stream key revoked.");
      }
    } catch (err: any) {
      notify("error", err.message || "Operation failed.");
    }
  };

  const copyToClipboard = (text: string, type: "url" | "key") => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const selectAndLoadStats = (item: any) => {
    setSelectedStream(item);
    setIssuedKeyOnce(null);
    fetchStreamStats(item.id);
  };

  const chartData = Array.isArray(streamAnalytics?.viewer_count_over_time)
    ? streamAnalytics.viewer_count_over_time
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6"
    >
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-purple-600" /> Live Broadcast Studio
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage broadcasts, rotate stream keys, schedule events, and monitor verified viewer & revenue metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 font-black text-white text-xs uppercase px-6 py-3 rounded-xl transition-all duration-200 shadow-md shadow-purple-600/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Broadcast
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            feedback.type === "error"
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingAction && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-200">
            {pendingAction.label}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 font-bold uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executePendingAction}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold uppercase cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={fetchArtistStreams}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold uppercase cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Streams List & Status Filter */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Broadcasts
            </h3>
            <span className="text-[11px] font-mono text-purple-600 font-bold">
              {streams.length} Total
            </span>
          </div>

          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#18181B] rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-black uppercase">
            {(["all", "live", "scheduled", "ended"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  statusFilter === tab
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {loading && streams.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-gray-400">LOADING...</div>
            ) : streams.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl space-y-3">
                <Video className="w-10 h-10 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 font-bold uppercase">No broadcasts found</p>
                <button
                  type="button"
                  onClick={() => setCreateModal(true)}
                  className="text-xs text-purple-600 font-black uppercase hover:underline cursor-pointer"
                >
                  Create your first stream
                </button>
              </div>
            ) : (
              streams.map((item) => {
                const isSelected = selectedStream?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectAndLoadStats(item)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 cursor-pointer ${
                      isSelected
                        ? "border-purple-600 bg-purple-600/10 dark:bg-purple-600/[0.06] shadow-xs"
                        : "border-gray-100 dark:border-zinc-800/80 bg-white dark:bg-[#121212] hover:border-gray-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          item.status === "live"
                            ? "bg-red-600 text-white"
                            : item.status === "scheduled"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {item.status}
                      </span>

                      {item.is_paid && (
                        <span className="text-[10px] font-black text-purple-600 flex items-center gap-0.5">
                          <DollarSign className="w-3.5 h-3.5" /> RWF{" "}
                          {Number(item.price_rwf || 0).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-gray-950 dark:text-white uppercase truncate tracking-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        {item.status === "scheduled" && item.scheduled_start
                          ? `Starts: ${new Date(item.scheduled_start).toLocaleString()}`
                          : `Created: ${new Date(item.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Broadcast Controller & Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStream ? (
            <div className="space-y-6">
              {/* Stream Control Card */}
              <div className="p-6 bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-[#222222] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-md">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        selectedStream.status === "live"
                          ? "bg-red-500 text-white"
                          : selectedStream.status === "scheduled"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-700 text-white"
                      }`}
                    >
                      {selectedStream.status}
                    </span>
                    {selectedStream.is_paid && (
                      <span className="text-[10px] font-black text-purple-600">
                        Paid Event • RWF {Number(selectedStream.price_rwf || 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-black uppercase text-gray-900 dark:text-white leading-tight tracking-tight">
                    {selectedStream.title}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-2">
                    {selectedStream.description || "No description provided."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {selectedStream.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => handleStartStream(selectedStream.id)}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Radio className="w-4 h-4" /> Go Live
                    </button>
                  )}

                  {selectedStream.status === "live" && (
                    <>
                      <Link
                        to={`/live/${selectedStream.id}`}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-black uppercase text-xs rounded-xl transition-all flex items-center gap-1.5"
                      >
                        Watch Room <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({
                            type: "end",
                            streamId: selectedStream.id,
                            label: "End this live broadcast and archive the session?",
                          })
                        }
                        className="px-4 py-2 bg-black hover:bg-zinc-900 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-black uppercase text-xs rounded-xl transition-all cursor-pointer border border-zinc-700"
                      >
                        End Stream
                      </button>
                    </>
                  )}

                  {selectedStream.status === "ended" && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-black uppercase font-mono px-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" /> Completed
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({
                        type: "delete",
                        streamId: selectedStream.id,
                        label: `Delete broadcast "${selectedStream.title}"?`,
                      })
                    }
                    className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                    title="Delete Broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* RTMP / Streaming Credentials */}
              <div className="p-6 bg-[#161617] text-white rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-purple-400 font-black uppercase text-xs tracking-wider">
                    <Key className="w-4 h-4" /> Ingest Server & Key Security
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({
                          type: "rotate_key",
                          streamId: selectedStream.id,
                          label: "Rotate stream key? Existing encoder connections using the old key will be invalidated.",
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 hover:text-white text-purple-300 text-[10px] font-black uppercase transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Rotate Key
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({
                          type: "revoke_key",
                          streamId: selectedStream.id,
                          label: "Revoke active stream key immediately?",
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 hover:text-white text-red-300 text-[10px] font-black uppercase transition-colors cursor-pointer"
                    >
                      <ShieldOff className="w-3 h-3" /> Revoke Key
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5 p-3.5 bg-black/40 rounded-2xl border border-zinc-800">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      Ingest Server URL
                    </span>
                    {selectedStream.ingest_url && selectedStream.provider_configured ? (
                      <div className="flex justify-between items-center bg-[#2C2C2E] p-2 rounded-xl border border-zinc-700/20">
                        <span className="text-[11px] select-all truncate text-purple-300 font-medium">
                          {selectedStream.ingest_url}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedStream.ingest_url, "url")}
                          className="text-[10px] bg-black/50 hover:bg-purple-600 text-white font-black uppercase px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedUrl ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-[#2C2C2E] p-2.5 rounded-xl border border-zinc-700/30 text-[11px] text-amber-300">
                        External RTMP/HLS ingest provider not configured in environment.
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-black/40 rounded-2xl border border-zinc-800">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      Secret Stream Key ({issuedKeyOnce ? "Single-Display Secret" : "Hashed & Masked"})
                    </span>
                    <div className="flex justify-between items-center bg-[#2C2C2E] p-2 rounded-xl border border-zinc-700/20 gap-2">
                      <span className="text-[11px] select-all truncate text-rose-300 font-medium">
                        {issuedKeyOnce
                          ? issuedKeyOnce
                          : selectedStream.stream_key_masked ||
                            (selectedStream.stream_key_revoked ? "Revoked" : "Stored securely (rotate to view new key)")}
                      </span>
                      {issuedKeyOnce && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(issuedKeyOnce, "key")}
                          className="text-[10px] bg-black/50 hover:bg-purple-600 text-white font-black uppercase px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedKey ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                    Peak Viewers
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-purple-600" />
                    {Number(streamAnalytics?.peak_viewers ?? selectedStream?.peak_viewers ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                    Active Viewers
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {Number(streamAnalytics?.current_viewers ?? selectedStream?.current_viewers ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                    Avg Watch Time
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    {Number(streamAnalytics?.avg_watch_time ?? 0)}m
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                    Chat Messages
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    {Number(streamAnalytics?.chat_messages ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                    Super Thanks
                  </span>
                  <div className="text-lg font-black text-emerald-500 flex items-center justify-center gap-0.5">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    {Number(streamAnalytics?.donations?.total ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Viewers Over Time Chart */}
              <div className="p-6 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-600" /> Viewer Sessions Over Time
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Aggregated directly from PostgreSQL viewer session telemetry
                    </p>
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl text-xs text-gray-500">
                    No viewer session data recorded yet for this broadcast.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="viewersGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9333EA" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#9333EA" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" opacity={0.3} />
                        <XAxis dataKey="time" stroke="#71717A" fontSize={11} />
                        <YAxis stroke="#71717A" fontSize={11} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="viewers"
                          stroke="#9333EA"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#viewersGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl space-y-3">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                Select or Create a Broadcast
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Choose a broadcast on the left or create a new one to manage stream keys and telemetry.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE BROADCAST MODAL */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] p-6 rounded-3xl space-y-6 shadow-2xl text-gray-900 dark:text-white"
          >
            <div className="text-center space-y-1.5">
              <Video className="w-10 h-10 text-purple-600 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight">Create Broadcast</h3>
              <p className="text-xs text-gray-500">
                Persist a new live broadcast record and generate a hashed stream key.
              </p>
            </div>

            <form onSubmit={handleCreateBroadcast} className="space-y-4 font-semibold text-xs text-left">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  Broadcast Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Broadcast title..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder="Describe this live broadcast..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 h-20 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-600" /> Scheduled Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduled}
                  onChange={(e) => setFormScheduled(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none"
                />
                <span className="text-[9px] text-gray-400 font-bold uppercase block mt-1">
                  Leave empty to go live immediately.
                </span>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wide block">
                      Paid Admission Ticket
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Requires viewers to buy a digital entry pass
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsPaid}
                    onChange={(e) => setFormIsPaid(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                </div>

                {formIsPaid && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-zinc-800"
                  >
                    <div>
                      <label className="text-gray-400 text-[9px] font-black uppercase tracking-wider block">
                        Price (RWF)
                      </label>
                      <input
                        type="number"
                        min="500"
                        required={formIsPaid}
                        value={formPriceRwf}
                        onChange={(e) => setFormPriceRwf(e.target.value)}
                        className="w-full bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-[9px] font-black uppercase tracking-wider block">
                        Price (USD)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        required={formIsPaid}
                        value={formPriceUsd}
                        onChange={(e) => setFormPriceUsd(e.target.value)}
                        className="w-full bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#1E1E22] rounded-xl text-center text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] rounded-xl tracking-wider transition-colors cursor-pointer"
                >
                  {formLoading ? "Creating..." : "Create Broadcast"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
