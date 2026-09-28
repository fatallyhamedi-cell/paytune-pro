import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Plus, 
  Video, 
  Radio, 
  Calendar, 
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
  Check
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useAuth } from "../../hooks/useAuth";

export default function LiveDashboard() {
  const { user } = useAuth();
  const [streams, setStreams] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [createModal, setCreateModal] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");
  const [formIsPaid, setFormIsPaid] = useState<boolean>(false);
  const [formPriceRwf, setFormPriceRwf] = useState<string>("1000");
  const [formPriceUsd, setFormPriceUsd] = useState<string>("1.00");
  const [formScheduled, setFormScheduled] = useState<string>("");
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Selected stream & stats
  const [selectedStream, setSelectedStream] = useState<any>(null);
  const [streamAnalytics, setStreamAnalytics] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    fetchArtistStreams();
  }, [statusFilter]);

  const getAuthToken = () => {
    try {
      const directToken = localStorage.getItem("paytune_auth_token");
      if (directToken) return directToken;
      const session = localStorage.getItem("paytune_mock_session");
      return session ? JSON.parse(session).access_token : null;
    } catch {
      return null;
    }
  };

  const fetchArtistStreams = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = statusFilter === "all" 
        ? "/api/artist/live" 
        : `/api/artist/live?status=${statusFilter}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Could not find your broadcast records.");

      const data = await res.json();
      setStreams(data);

      if (data.length > 0) {
        // If current selection is still in list, keep it, otherwise select first
        const found = data.find((s: any) => s.id === selectedStream?.id);
        const toSelect = found || data[0];
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
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDesc,
          is_paid: formIsPaid,
          price_rwf: formIsPaid ? Number(formPriceRwf) : null,
          price_usd: formIsPaid ? Number(formPriceUsd) : null,
          scheduled_start: formScheduled || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create broadcast.");
      }

      const data = await res.json();
      setCreateModal(false);
      setFormTitle("");
      setFormDesc("");
      setFormIsPaid(false);
      setFormPriceRwf("1000");
      setFormPriceUsd("1.00");
      setFormScheduled("");

      await fetchArtistStreams();
      if (data.stream) {
        setSelectedStream(data.stream);
        fetchStreamStats(data.stream.id);
      }
    } catch (err: any) {
      alert("Error creating broadcast: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleStartStream = async (id: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/artist/live/${id}/start`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not transition stream to live.");
      
      const updated = await res.json();
      setSelectedStream(updated.stream);
      fetchArtistStreams();
      fetchStreamStats(id);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleEndStream = async (id: string) => {
    if (!confirm("Are you sure you want to end this live broadcast? The recording will be archived.")) return;

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/artist/live/${id}/end`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to conclude broadcast segment.");

      const updated = await res.json();
      setSelectedStream(updated.stream);
      fetchArtistStreams();
      fetchStreamStats(id);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDeleteStream = async (id: string) => {
    if (!confirm("Are you sure you want to delete this broadcast?")) return;

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/artist/live/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete broadcast.");

      fetchArtistStreams();
    } catch (err: any) {
      alert("Error deleting stream: " + err.message);
    }
  };

  const copyToClipboard = (text: string, type: "url" | "key") => {
    navigator.clipboard.writeText(text);
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
    fetchStreamStats(item.id);
  };

  const chartData = streamAnalytics?.viewer_count_over_time || [
    { time: "00:00", viewers: 0 },
    { time: "05:00", viewers: 12 },
    { time: "10:00", viewers: 28 },
    { time: "15:00", viewers: 42 },
    { time: "20:00", viewers: 36 }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8"
    >
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-amber-500 animate-pulse" /> Live Broadcast Studio
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage RTMP ingestion, schedule concerts, monitor viewers, and review Super Thanks revenue.
          </p>
        </div>

        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 font-black text-black text-xs uppercase px-6 py-3 rounded-full transition-all duration-200 shadow-md shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Broadcast
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 rounded-2xl text-xs uppercase font-semibold">
          {error}
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
            <span className="text-[11px] font-mono text-amber-500 font-bold">
              {streams.length} Total
            </span>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#18181B] rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-black uppercase">
            {(["all", "live", "scheduled", "ended"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                  statusFilter === tab
                    ? "bg-amber-500 text-black shadow-xs"
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
              <div className="p-8 text-center border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-3xl space-y-3">
                <Video className="w-10 h-10 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 font-bold uppercase">No broadcasts found</p>
                <button 
                  onClick={() => setCreateModal(true)} 
                  className="text-xs text-amber-500 font-black uppercase hover:underline"
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
                    onClick={() => selectAndLoadStats(item)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 cursor-pointer ${
                      isSelected 
                        ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/[0.06] shadow-xs" 
                        : "border-gray-100 dark:border-zinc-800/80 bg-white dark:bg-[#121212] hover:border-gray-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.status === "live" 
                          ? "bg-red-600 text-white animate-pulse" 
                          : item.status === "scheduled" 
                          ? "bg-amber-500 text-black" 
                          : "bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"
                      }`}>
                        {item.status}
                      </span>

                      {item.is_paid && (
                        <span className="text-[10px] font-black text-amber-500 flex items-center gap-0.5">
                          <DollarSign className="w-3.5 h-3.5" /> RWF {Number(item.price_rwf || 0).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-gray-950 dark:text-white uppercase truncate tracking-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        {item.status === "scheduled" 
                          ? `Starts: ${new Date(item.scheduled_start).toLocaleString()}` 
                          : `Created: ${new Date(item.created_at).toLocaleDateString()}`
                        }
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
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      selectedStream.status === "live"
                        ? "bg-red-500 text-white"
                        : selectedStream.status === "scheduled"
                        ? "bg-amber-500 text-black"
                        : "bg-zinc-700 text-white"
                    }`}>
                      {selectedStream.status}
                    </span>
                    {selectedStream.is_paid && (
                      <span className="text-[10px] font-black text-amber-500">
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
                      onClick={() => handleStartStream(selectedStream.id)}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Radio className="w-4 h-4 fill-current animate-pulse" /> Go Live
                    </button>
                  )}
                  
                  {selectedStream.status === "live" && (
                    <>
                      <Link
                        to={`/live/${selectedStream.id}`}
                        target="_blank"
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-black uppercase text-xs rounded-full transition-all flex items-center gap-1.5"
                      >
                        Watch Room <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={() => handleEndStream(selectedStream.id)}
                        className="px-4 py-2 bg-black hover:bg-zinc-850 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-black uppercase text-xs rounded-full transition-all cursor-pointer border border-zinc-700"
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

                  {/* Delete broadcast option */}
                  <button
                    onClick={() => handleDeleteStream(selectedStream.id)}
                    className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
                    title="Delete Broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* OBS RTMP Credentials */}
              <div className="p-6 bg-[#161617] text-white rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-500 font-black uppercase text-xs tracking-wider">
                    <Key className="w-4 h-4" /> OBS / Streaming Software Credentials
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">RTMP 1080p60</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5 p-3.5 bg-black/40 rounded-2xl border border-zinc-800">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Ingest Server URL</span>
                    <div className="flex justify-between items-center bg-[#2C2C2E] p-2 rounded-xl border border-zinc-700/20">
                      <span className="text-[11px] select-all truncate text-amber-500 font-medium">rtmp://live.paytune.com/app</span>
                      <button 
                        onClick={() => copyToClipboard("rtmp://live.paytune.com/app", "url")}
                        className="text-[10px] bg-black/50 hover:bg-amber-500 hover:text-black font-black uppercase px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedUrl ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-black/40 rounded-2xl border border-zinc-800">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Secret Stream Key</span>
                    <div className="flex justify-between items-center bg-[#2C2C2E] p-2 rounded-xl border border-zinc-700/20">
                      <span className="text-[11px] select-all truncate text-rose-400 font-medium">{selectedStream.stream_key || "stream_key_pending"}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedStream.stream_key || "", "key")}
                        className="text-[10px] bg-black/50 hover:bg-amber-500 hover:text-black font-black uppercase px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedKey ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Peak Viewers</span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-amber-500" />
                    {streamAnalytics?.peak_viewers || streamAnalytics?.peakViewers || 0}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Total Viewers</span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {streamAnalytics?.total_viewers || selectedStream?.total_viewers || 0}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Avg Watch Time</span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    {streamAnalytics?.avg_watch_time ? `${streamAnalytics.avg_watch_time}m` : "14.5m"}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Chat Messages</span>
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    {streamAnalytics?.chat_messages || streamAnalytics?.totalChatMessages || 0}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Super Thanks</span>
                  <div className="text-lg font-black text-emerald-500 flex items-center justify-center gap-0.5">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    {((streamAnalytics?.donations?.total || streamAnalytics?.totalDonations || 0) as number).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Viewers Over Time Recharts Analytics */}
              <div className="p-6 bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-500" /> Viewer Count Over Time
                    </h3>
                    <p className="text-[11px] text-gray-500">Real-time attendance telemetry throughout the broadcast</p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase">Interactive Graph</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="viewersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" opacity={0.3} />
                      <XAxis dataKey="time" stroke="#71717A" fontSize={11} />
                      <YAxis stroke="#71717A" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "#18181B", 
                          borderColor: "#27272A",
                          borderRadius: "12px",
                          color: "#FFF",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="viewers" 
                        stroke="#F59E0B" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#viewersGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-3xl space-y-3">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Select a Live Concert</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Pick a stream from the left list or create an instant broadcast to view RTMP ingestion credentials.
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
              <Video className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight">Create Broadcast</h3>
              <p className="text-xs text-gray-500">Configure parameters for virtual concerts, fan conversations, or digital events.</p>
            </div>

            <form onSubmit={handleCreateBroadcast} className="space-y-4 font-semibold text-xs text-left">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">Broadcast Title *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Bruce Melodie Live MoMo Concert"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Outline the songs, special guests, or segment flow..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 h-20 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Scheduled Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduled}
                  onChange={(e) => setFormScheduled(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none"
                />
                <span className="text-[9px] text-gray-400 font-bold uppercase block mt-1">Leave empty to go live immediately.</span>
              </div>

              {/* Paid Ticket Settings */}
              <div className="p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wide block">
                      Paid Admission Ticket
                    </span>
                    <span className="text-[10px] text-gray-400">Requires viewers to buy a digital entry pass</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsPaid}
                    onChange={(e) => setFormIsPaid(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                {formIsPaid && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-zinc-800"
                  >
                    <div>
                      <label className="text-gray-400 text-[9px] font-black uppercase tracking-wider block">Price (RWF)</label>
                      <input
                        type="number"
                        min="500"
                        required={formIsPaid}
                        placeholder="1000"
                        value={formPriceRwf}
                        onChange={(e) => setFormPriceRwf(e.target.value)}
                        className="w-full bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-[9px] font-black uppercase tracking-wider block">Price (USD)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        required={formIsPaid}
                        placeholder="1.00"
                        value={formPriceUsd}
                        onChange={(e) => setFormPriceUsd(e.target.value)}
                        className="w-full bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
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
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-[10px] rounded-xl tracking-wider transition-colors cursor-pointer"
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
