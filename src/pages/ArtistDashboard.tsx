import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { ArtistDashboardLayout } from "../components/artist/ArtistDashboardLayout";
import { OverviewTab } from "../components/artist/OverviewTab";
import { VideosTab } from "../components/artist/VideosTab";
import { EarningsTab } from "../components/artist/EarningsTab";
import { CopyrightTab } from "../components/artist/CopyrightTab";
import { AnalyticsTab } from "../components/artist/AnalyticsTab";
import { LiveStudioTab } from "../components/artist/LiveStudioTab";
import { SettingsTab } from "../components/artist/SettingsTab";
import { SubscribersTab } from "../components/artist/SubscribersTab";
import { WithdrawalModal } from "../components/artist/WithdrawalModal";
import { VideoUploadModal } from "../components/artist/VideoUploadModal";
import { Loader2, AlertCircle } from "lucide-react";

export default function ArtistDashboard() {
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get("tab") || "overview";

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(searchParams.get("action") === "upload");
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(searchParams.get("action") === "withdraw");

  const fetchDashboard = async () => {
    try {
      setError(null);
      const res = await axios.get("/api/artist/dashboard");
      setDashboardData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch artist dashboard:", err);
      // Fallback try with userId if needed
      if (user?.id) {
        try {
          const fallbackRes = await axios.get(`/api/artist/${user.id}/dashboard`);
          setDashboardData(fallbackRes.data);
          return;
        } catch {
          // ignore
        }
      }
      setError(err.response?.data?.error || "Could not load artist dashboard. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-8 h-8 text-[#FFB300] animate-spin" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Loading Creator Studio...
        </p>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-[#FFB300] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">Creator Studio Access</h3>
          <p className="text-xs text-gray-400 leading-relaxed">{error}</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => fetchDashboard()}
              className="flex-1 py-2.5 rounded-xl bg-[#FFB300] text-black text-xs font-black hover:bg-[#ffc107] transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/5 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const artist = dashboardData?.artist || {
    full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Artist Studio',
    username: user?.user_metadata?.username || user?.email?.split('@')[0] || 'artist',
    subscriber_count: 0,
    avatar_url: ''
  };

  const summary = dashboardData?.summary || {
    total_earnings: 0,
    current_balance: 0,
    pending_balance: 0,
    total_views: 0,
    subscriber_count: 0,
    video_count: dashboardData?.videos?.length || 0
  };

  const earningsGraph = dashboardData?.earningsGraph || {};
  const videos = dashboardData?.videos || [];
  const withdrawals = dashboardData?.withdrawals || [];
  const recentActivity = dashboardData?.recentActivity || [];

  return (
    <ArtistDashboardLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      artist={artist}
      onOpenUpload={() => setUploadModalOpen(true)}
      onSignOut={handleSignOut}
    >
      {/* Dynamic Tab Views */}
      {activeTab === "overview" && (
        <OverviewTab
          summary={summary}
          earningsGraph={earningsGraph}
          videos={videos}
          recentActivity={recentActivity}
          onOpenUpload={() => setUploadModalOpen(true)}
          onOpenWithdraw={() => setWithdrawModalOpen(true)}
          onNavigateTab={handleTabChange}
        />
      )}

      {activeTab === "videos" && (
        <VideosTab
          videos={videos}
          onOpenUpload={() => setUploadModalOpen(true)}
          onRefresh={fetchDashboard}
        />
      )}

      {activeTab === "earnings" && (
        <EarningsTab
          summary={summary}
          earningsGraph={earningsGraph}
          videos={videos}
          withdrawals={withdrawals}
          onOpenWithdraw={() => setWithdrawModalOpen(true)}
        />
      )}

      {activeTab === "copyright" && <CopyrightTab />}

      {activeTab === "analytics" && (
        <AnalyticsTab
          summary={summary}
          videos={videos}
        />
      )}

      {activeTab === "subscribers" && (
        <SubscribersTab
          artist={artist}
        />
      )}

      {activeTab === "live" && (
        <LiveStudioTab
          artist={artist}
        />
      )}

      {activeTab === "settings" && (
        <SettingsTab
          artist={artist}
          onUpdateSuccess={fetchDashboard}
        />
      )}

      {/* Global Modals */}
      <WithdrawalModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        availableBalance={Number(summary?.current_balance || summary?.pending_balance || 0)}
        artistId={artist?.id || 'artist-1'}
        defaultPhone={artist?.momo_code || artist?.phone || '0788112233'}
        onSuccess={fetchDashboard}
      />

      <VideoUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchDashboard();
          handleTabChange("videos");
        }}
      />
    </ArtistDashboardLayout>
  );
}
