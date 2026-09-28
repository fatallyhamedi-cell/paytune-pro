import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Eye,
  MousePointerClick,
  TrendingUp,
  Wallet,
  Globe,
  Video,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Smartphone,
  Monitor,
  RefreshCw,
  Clock,
  X,
  Upload,
  ShieldCheck
} from "lucide-react";

interface AdCreative {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  click_url?: string;
  duration_seconds: number;
  advertiser_name: string;
  budget_rwf: number;
  spent_rwf: number;
  status: "active" | "paused" | "ended";
  created_at: string;
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: string;
    ctr_num: number;
    active_assignments: number;
    total_assignments: number;
  };
}

interface AdAssignment {
  id: string;
  ad_id: string;
  scope: "global" | "single";
  video_id: string | null;
  priority: number;
  status: "active" | "paused" | "ended";
  start_date: string;
  end_date: string | null;
  created_at: string;
  ad?: { id: string; title: string; advertiser_name: string } | null;
  video?: { id: string; title: string; is_free: boolean } | null;
}

interface AnalyticsData {
  overview: {
    total_impressions: number;
    total_clicks: number;
    overall_ctr: string;
    overall_ctr_num: number;
    total_spent_rwf: number;
    active_campaigns_count: number;
  };
  device_breakdown: Record<string, number>;
  country_breakdown: Record<string, number>;
  recent_impressions: Array<{
    id: string;
    ad_id: string;
    ad_title: string;
    advertiser_name: string;
    video_id: string | null;
    country: string;
    device: string;
    watched_seconds: number;
    clicked: boolean;
    created_at: string;
  }>;
}

export function MasterAdsManager() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "placements" | "analytics">("campaigns");
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [assignments, setAssignments] = useState<AdAssignment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [availableVideos, setAvailableVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal states
  const [showCreateAdModal, setShowCreateAdModal] = useState(false);
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);

  // Form states: Create Ad
  const [newAdTitle, setNewAdTitle] = useState("");
  const [newAdDescription, setNewAdDescription] = useState("");
  const [newAdVideoUrl, setNewAdVideoUrl] = useState("");
  const [newAdThumbnailUrl, setNewAdThumbnailUrl] = useState("");
  const [newAdClickUrl, setNewAdClickUrl] = useState("");
  const [newAdDuration, setNewAdDuration] = useState(15);
  const [newAdAdvertiser, setNewAdAdvertiser] = useState("");
  const [newAdBudget, setNewAdBudget] = useState(250000);

  // Form states: Create Assignment
  const [selectedAdId, setSelectedAdId] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<"global" | "single">("global");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [assignmentPriority, setAssignmentPriority] = useState(5);

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("paytune_token") || "master_token"}`
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adsRes, assignmentsRes, analyticsRes, videosRes] = await Promise.all([
        axios.get("/api/ads/master/list", authHeaders).catch(() => ({ data: { ads: [] } })),
        axios.get("/api/ads/master/assignments", authHeaders).catch(() => ({ data: { assignments: [] } })),
        axios.get("/api/ads/master/analytics", authHeaders).catch(() => ({ data: null })),
        axios.get("/api/videos").catch(() => ({ data: { videos: [] } }))
      ]);

      setAds(adsRes.data?.ads || []);
      setAssignments(assignmentsRes.data?.assignments || []);
      if (analyticsRes.data?.overview) {
        setAnalytics(analyticsRes.data);
      }

      // Filter available videos (only free, non-short videos qualify for ads)
      const rawVideos = videosRes.data?.videos || [];
      const freeEligible = rawVideos.filter(
        (v: any) => v.is_free === true && !v.is_short && v.category !== "Shorts"
      );
      setAvailableVideos(freeEligible);
    } catch (err: any) {
      console.error("Error fetching Master Ads data:", err);
      showNotice("error", "Failed to load Ads data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotice = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // 1. Create New Ad Creative
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdTitle.trim() || !newAdVideoUrl.trim()) {
      showNotice("error", "Ad title and Video URL are required.");
      return;
    }

    try {
      const res = await axios.post(
        "/api/ads/master/create",
        {
          title: newAdTitle,
          description: newAdDescription,
          video_url: newAdVideoUrl,
          thumbnail_url: newAdThumbnailUrl,
          click_url: newAdClickUrl,
          duration_seconds: newAdDuration,
          advertiser_name: newAdAdvertiser || "Advertiser",
          budget_rwf: newAdBudget
        },
        authHeaders
      );

      if (res.data?.success) {
        showNotice("success", `Ad campaign "${newAdTitle}" created successfully!`);
        setShowCreateAdModal(false);
        // Reset form
        setNewAdTitle("");
        setNewAdDescription("");
        setNewAdVideoUrl("");
        setNewAdThumbnailUrl("");
        setNewAdClickUrl("");
        setNewAdDuration(15);
        setNewAdAdvertiser("");
        setNewAdBudget(250000);
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", err.response?.data?.message || "Failed to create ad campaign");
    }
  };

  // 2. Toggle Ad Creative Status (Pause / Resume)
  const handleToggleAdStatus = async (ad: AdCreative) => {
    const nextStatus = ad.status === "active" ? "paused" : "active";
    try {
      const res = await axios.put(
        `/api/ads/master/${ad.id}`,
        { status: nextStatus },
        authHeaders
      );
      if (res.data?.success) {
        showNotice("success", `Ad status changed to ${nextStatus}`);
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", "Failed to update ad status");
    }
  };

  // 3. Delete Ad Creative
  const handleDeleteAd = async (adId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete ad creative "${title}" and all its placements?`)) {
      return;
    }

    try {
      const res = await axios.delete(`/api/ads/master/${adId}`, authHeaders);
      if (res.data?.success) {
        showNotice("success", `Ad "${title}" deleted.`);
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", "Failed to delete ad");
    }
  };

  // 4. Create Placement / Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdId) {
      showNotice("error", "Please select an ad creative.");
      return;
    }

    if (assignmentScope === "single" && !selectedVideoId) {
      showNotice("error", "Please select a target free video for single assignment.");
      return;
    }

    try {
      const res = await axios.post(
        "/api/ads/master/assignments",
        {
          ad_id: selectedAdId,
          scope: assignmentScope,
          video_id: assignmentScope === "single" ? selectedVideoId : null,
          priority: assignmentPriority
        },
        authHeaders
      );

      if (res.data?.success) {
        showNotice("success", res.data.message || "Ad assignment created successfully!");
        setShowCreateAssignmentModal(false);
        setSelectedAdId("");
        setSelectedVideoId("");
        setAssignmentScope("global");
        setAssignmentPriority(5);
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", err.response?.data?.message || "Failed to create assignment");
    }
  };

  // 5. Toggle Assignment Status
  const handleToggleAssignmentStatus = async (assign: AdAssignment) => {
    const nextStatus = assign.status === "active" ? "paused" : "active";
    try {
      const res = await axios.put(
        `/api/ads/master/assignments/${assign.id}`,
        { status: nextStatus },
        authHeaders
      );
      if (res.data?.success) {
        showNotice("success", `Placement status set to ${nextStatus}`);
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", "Failed to update placement");
    }
  };

  // 6. Delete Assignment
  const handleDeleteAssignment = async (assignId: string) => {
    if (!window.confirm("Remove this ad placement assignment?")) return;
    try {
      const res = await axios.delete(`/api/ads/master/assignments/${assignId}`, authHeaders);
      if (res.data?.success) {
        showNotice("success", "Placement removed.");
        fetchData();
      }
    } catch (err: any) {
      showNotice("error", "Failed to delete placement");
    }
  };

  const totalImpressions = analytics?.overview?.total_impressions ?? 0;
  const totalClicks = analytics?.overview?.total_clicks ?? 0;
  const overallCtr = analytics?.overview?.overall_ctr ?? "0%";
  const totalSpent = analytics?.overview?.total_spent_rwf ?? 0;
  const activeCampaignsCount = analytics?.overview?.active_campaigns_count ?? ads.filter(a => a.status === "active").length;

  return (
    <div id="master-ads-manager" className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          id="ads-feedback-notice"
          className={`flex items-center gap-2 p-3.5 rounded-xl border text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          } animate-fadeIn`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Top Header & Overview KPI Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">PAYTUNE Ads & Monetization Center</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage video advertisements, global campaigns, and single free video targeting
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-ads-data"
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            id="btn-open-create-assignment"
            onClick={() => setShowCreateAssignmentModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Assign Placement</span>
          </button>

          <button
            id="btn-open-create-ad"
            onClick={() => setShowCreateAdModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            Total Impressions
          </span>
          <div className="text-2xl font-black text-white mt-2">{totalImpressions.toLocaleString()}</div>
          <span className="text-[10px] text-neutral-500 mt-1">Free video views</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
            Ad Clicks
          </span>
          <div className="text-2xl font-black text-white mt-2">{totalClicks.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-400/80 mt-1">CTR: {overallCtr}</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            Active Campaigns
          </span>
          <div className="text-2xl font-black text-white mt-2">{activeCampaignsCount}</div>
          <span className="text-[10px] text-neutral-500 mt-1">{ads.length} total creatives</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            Total Ad Spend
          </span>
          <div className="text-2xl font-black text-amber-400 mt-2">{totalSpent.toLocaleString()} RWF</div>
          <span className="text-[10px] text-neutral-500 mt-1">Billable impressions</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Ad-Free Rules
          </span>
          <div className="text-xs text-neutral-300 font-bold mt-2 flex flex-col gap-1">
            <span className="text-emerald-400">✓ Paid Videos: 100% Ad-Free</span>
            <span className="text-blue-400">✓ Shorts: 100% Ad-Free</span>
          </div>
          <span className="text-[10px] text-neutral-500 mt-1">Platform-enforced</span>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-neutral-800 gap-6">
        <button
          id="tab-ads-campaigns"
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "campaigns"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Ad Creatives ({ads.length})</span>
        </button>

        <button
          id="tab-ads-placements"
          onClick={() => setActiveTab("placements")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "placements"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Placements & Targeting ({assignments.length})</span>
        </button>

        <button
          id="tab-ads-analytics"
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "analytics"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Analytics & Telemetry</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: AD CREATIVES & CAMPAIGNS                      */}
      {/* ==================================================== */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ads.map((ad) => (
              <div
                key={ad.id}
                id={`ad-card-${ad.id}`}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between hover:border-neutral-700 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            ad.status === "active"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : ad.status === "paused"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {ad.status}
                        </span>
                        <span className="text-xs font-semibold text-neutral-400">
                          {ad.advertiser_name}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1.5 line-clamp-1">{ad.title}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleAdStatus(ad)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          ad.status === "active"
                            ? "bg-neutral-800 border-neutral-700 text-amber-400 hover:bg-neutral-700"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                        title={ad.status === "active" ? "Pause Ad" : "Activate Ad"}
                      >
                        {ad.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDeleteAd(ad.id, ad.title)}
                        className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors cursor-pointer"
                        title="Delete Ad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {ad.description && (
                    <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{ad.description}</p>
                  )}

                  {/* Metrics bar */}
                  <div className="grid grid-cols-4 gap-2 mt-4 p-3 rounded-lg bg-black/40 border border-neutral-800/80 text-center">
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-semibold">Duration</div>
                      <div className="text-xs font-bold text-neutral-200 mt-0.5">{ad.duration_seconds}s</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-semibold">Impressions</div>
                      <div className="text-xs font-bold text-neutral-200 mt-0.5">
                        {ad.metrics?.impressions ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-semibold">Clicks</div>
                      <div className="text-xs font-bold text-neutral-200 mt-0.5">
                        {ad.metrics?.clicks ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-semibold">CTR</div>
                      <div className="text-xs font-bold text-amber-400 mt-0.5">
                        {ad.metrics?.ctr ?? "0%"}
                      </div>
                    </div>
                  </div>

                  {/* Budget & Spend Progress */}
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Budget Spent</span>
                      <span className="text-neutral-200 font-bold">
                        {(ad.spent_rwf || 0).toLocaleString()} / {(ad.budget_rwf || 0).toLocaleString()} RWF
                      </span>
                    </div>
                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            ad.budget_rwf > 0 ? ((ad.spent_rwf || 0) / ad.budget_rwf) * 100 : 0
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Link & Assignments */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-1">
                    <span>Active in</span>
                    <strong className="text-white font-semibold">
                      {ad.metrics?.active_assignments ?? 0} placement(s)
                    </strong>
                  </div>

                  {ad.click_url && (
                    <a
                      href={ad.click_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <span>Destination</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {ads.length === 0 && !loading && (
            <div className="p-12 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
              <Megaphone className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Ad Campaigns Yet</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Create an ad creative to start monetizing free videos on PAYTUNE.
              </p>
              <button
                onClick={() => setShowCreateAdModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all cursor-pointer"
              >
                Create First Ad Creative
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: PLACEMENTS & TARGETING                        */}
      {/* ==================================================== */}
      {activeTab === "placements" && (
        <div className="space-y-4">
          {/* Policy Information Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-neutral-300 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-400">Placement Targeting Rules</div>
              <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                <li><strong>PAID VIDEOS NEVER SHOW ADS:</strong> Premium purchases are 100% ad-free forever.</li>
                <li><strong>Shorts never show ads:</strong> Vertical shorts maintain frictionless high-speed scrolls.</li>
                <li><strong>Global Placements:</strong> Serve automatically across all free videos on the platform.</li>
                <li><strong>Single Targeted Placements:</strong> Target one specific free video (priority override).</li>
              </ul>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/60 text-neutral-400 uppercase text-[10px] font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Ad Creative</th>
                    <th className="px-4 py-3">Target Scope</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                  {assignments.map((assign) => (
                    <tr key={assign.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="line-clamp-1">{assign.ad?.title || "Ad Campaign"}</div>
                        <div className="text-[11px] text-neutral-400 font-normal">{assign.ad?.advertiser_name}</div>
                      </td>

                      <td className="px-4 py-3">
                        {assign.scope === "global" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                            <Globe className="w-3 h-3" />
                            <span>All Free Videos (Global)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold text-[11px]">
                            <Video className="w-3 h-3" />
                            <span className="line-clamp-1 max-w-[180px]">
                              {assign.video?.title ? `Single: ${assign.video.title}` : `Video: ${assign.video_id?.substring(0, 8)}...`}
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono font-bold">
                          P-{assign.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            assign.status === "active"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {assign.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-neutral-400 font-mono text-[11px]">
                        {new Date(assign.start_date).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleAssignmentStatus(assign)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                            title={assign.status === "active" ? "Pause Placement" : "Resume Placement"}
                          >
                            {assign.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Placement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {assignments.length === 0 && !loading && (
                <div className="p-8 text-center text-neutral-500">
                  No active ad placements configured. Assign an ad to all free videos or target one specific free video.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: ANALYTICS & TELEMETRY                         */}
      {/* ==================================================== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device breakdown */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>Audience by Device</span>
              </h3>
              <div className="mt-4 space-y-3">
                {Object.entries(analytics?.device_breakdown || { desktop: 2, mobile: 1 }).map(
                  ([dev, count]) => {
                    const pct = totalImpressions > 0 ? Math.round((Number(count) / totalImpressions) * 100) : 50;
                    return (
                      <div key={dev} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="capitalize text-neutral-300 font-semibold">{dev}</span>
                          <span className="text-neutral-400">{count} views ({pct}%)</span>
                        </div>
                        <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Geographic breakdown */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Audience by Country</span>
              </h3>
              <div className="mt-4 space-y-3">
                {Object.entries(analytics?.country_breakdown || { Rwanda: 3 }).map(
                  ([country, count]) => {
                    const pct = totalImpressions > 0 ? Math.round((Number(count) / totalImpressions) * 100) : 100;
                    return (
                      <div key={country} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-300 font-semibold">{country}</span>
                          <span className="text-neutral-400">{count} views ({pct}%)</span>
                        </div>
                        <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* Real-time Recent Impressions Stream */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Real-Time Ad Impressions Feed</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/60 text-neutral-400 uppercase text-[10px] font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-3 py-2.5">Ad Title</th>
                    <th className="px-3 py-2.5">Advertiser</th>
                    <th className="px-3 py-2.5">Country</th>
                    <th className="px-3 py-2.5">Device</th>
                    <th className="px-3 py-2.5">Watched</th>
                    <th className="px-3 py-2.5 text-right">Interaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                  {(analytics?.recent_impressions || []).map((imp) => (
                    <tr key={imp.id} className="hover:bg-neutral-800/30">
                      <td className="px-3 py-2.5 font-mono text-neutral-400 text-[11px]">
                        {new Date(imp.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white line-clamp-1">
                        {imp.ad_title}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-400">{imp.advertiser_name}</td>
                      <td className="px-3 py-2.5">{imp.country}</td>
                      <td className="px-3 py-2.5 capitalize">{imp.device}</td>
                      <td className="px-3 py-2.5 font-mono">{imp.watched_seconds}s</td>
                      <td className="px-3 py-2.5 text-right">
                        {imp.clicked ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                            CLICKED
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!analytics?.recent_impressions || analytics.recent_impressions.length === 0) && (
                <div className="p-6 text-center text-neutral-500 text-xs">
                  No impressions recorded yet. Free video playback triggers impressions automatically.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREATE AD CREATIVE                            */}
      {/* ==================================================== */}
      {showCreateAdModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Create New Ad Campaign</h3>
              </div>
              <button
                onClick={() => setShowCreateAdModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAd} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Campaign Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTN MoMo Fast Transfers"
                  value={newAdTitle}
                  onChange={(e) => setNewAdTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Advertiser Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTN Rwanda"
                  value={newAdAdvertiser}
                  onChange={(e) => setNewAdAdvertiser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-neutral-300 font-semibold">Video Stream URL (MP4 / HLS) *</label>
                  <span className="text-[10px] text-amber-400 font-semibold">Supports direct MP4 or upload</span>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://vjs.zencdn.net/v/oceans.mp4"
                  value={newAdVideoUrl}
                  onChange={(e) => setNewAdVideoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none text-xs"
                />
                {/* Sample high quality ad video presets for fast testing */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-neutral-500 font-bold">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdVideoUrl("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4");
                      setNewAdThumbnailUrl("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80");
                      setNewAdTitle("MTN 5G Unlimited Music Streaming");
                      setNewAdAdvertiser("MTN Rwanda");
                      setNewAdClickUrl("https://www.mtn.co.rw");
                      setNewAdDuration(15);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 cursor-pointer transition-all"
                  >
                    MTN 5G (15s)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdVideoUrl("https://www.w3schools.com/html/mov_bbb.mp4");
                      setNewAdThumbnailUrl("https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80");
                      setNewAdTitle("Airtel Money Super Boost");
                      setNewAdAdvertiser("Airtel Africa");
                      setNewAdClickUrl("https://www.airtel.africa");
                      setNewAdDuration(15);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 cursor-pointer transition-all"
                  >
                    Airtel Money (15s)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdVideoUrl("https://vjs.zencdn.net/v/oceans.mp4");
                      setNewAdThumbnailUrl("https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80");
                      setNewAdTitle("Kigali Sounds Music Fest 2026");
                      setNewAdAdvertiser("Kigali Live Events");
                      setNewAdClickUrl("https://kigalilive.rw");
                      setNewAdDuration(12);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 cursor-pointer transition-all"
                  >
                    Kigali Fest (12s)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Thumbnail Poster URL</label>
                  <input
                    type="url"
                    placeholder="https://.../thumbnail.jpg"
                    value={newAdThumbnailUrl}
                    onChange={(e) => setNewAdThumbnailUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Destination Landing URL</label>
                  <input
                    type="url"
                    placeholder="https://www.mtn.co.rw"
                    value={newAdClickUrl}
                    onChange={(e) => setNewAdClickUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Duration (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={newAdDuration}
                    onChange={(e) => setNewAdDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Budget (RWF)</label>
                  <input
                    type="number"
                    min="10000"
                    step="5000"
                    value={newAdBudget}
                    onChange={(e) => setNewAdBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Short Description</label>
                <textarea
                  rows={2}
                  placeholder="Promotional copy displayed in the ad viewer..."
                  value={newAdDescription}
                  onChange={(e) => setNewAdDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateAdModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREATE AD PLACEMENT / ASSIGNMENT              */}
      {/* ==================================================== */}
      {showCreateAssignmentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Assign Ad Placement</h3>
              </div>
              <button
                onClick={() => setShowCreateAssignmentModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              {/* Select Ad */}
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Select Ad Creative *</label>
                <select
                  required
                  value={selectedAdId}
                  onChange={(e) => setSelectedAdId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Choose an Ad Creative --</option>
                  {ads.map((ad) => (
                    <option key={ad.id} value={ad.id}>
                      {ad.title} ({ad.advertiser_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope Radio Selector */}
              <div>
                <label className="block text-neutral-300 font-semibold mb-2">Target Scope *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      assignmentScope === "global"
                        ? "bg-amber-500/10 border-amber-500/50 text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={assignmentScope === "global"}
                      onChange={() => setAssignmentScope("global")}
                      className="text-amber-500"
                    />
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-amber-400" />
                        <span>All Free Videos</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">Global platform campaign</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      assignmentScope === "single"
                        ? "bg-amber-500/10 border-amber-500/50 text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={assignmentScope === "single"}
                      onChange={() => setAssignmentScope("single")}
                      className="text-amber-500"
                    />
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-blue-400" />
                        <span>Single Free Video</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">Targeted placement</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Single Video Picker (Only displayed when scope is 'single') */}
              {assignmentScope === "single" && (
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Target Free Video *</label>
                  <select
                    required
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Choose Free Video --</option>
                    {availableVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.artist_name || "PAYTUNE Artist"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>Paid videos and Shorts are strictly excluded from ad placements.</span>
                  </p>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Serving Priority: {assignmentPriority} (10 = Highest)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={assignmentPriority}
                  onChange={(e) => setAssignmentPriority(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                  <span>Normal (1)</span>
                  <span>High (5)</span>
                  <span>Highest (10)</span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateAssignmentModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  Save Placement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
