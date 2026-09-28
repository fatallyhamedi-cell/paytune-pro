import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { MasterDashboardLayout, MasterTab } from "../components/MasterDashboardLayout";
import { MasterImpersonateBanner } from "../components/MasterImpersonateBanner";
import { MasterOverview } from "../components/MasterOverview";
import { ArtistManagement } from "../components/ArtistManagement";
import { UserManagement } from "../components/UserManagement";
import { VideoManagement } from "../components/VideoManagement";
import { MasterAdsManager } from "../components/MasterAdsManager";
import { PaymentManagement } from "../components/PaymentManagement";
import { WithdrawalManagement } from "../components/WithdrawalManagement";
import { MasterCopyrightCenter } from "../components/MasterCopyrightCenter";
import { MasterSettings } from "../components/MasterSettings";
import { MasterReports } from "../components/MasterReports";
import { AdminLogs } from "../components/AdminLogs";
import { MasterDiagnostics } from "../components/MasterDiagnostics";
import { MasterLogin } from "./MasterLogin";

import { useMasterStats } from "../hooks/useMasterStats";
import { useMasterArtists } from "../hooks/useMasterArtists";
import { useMasterUsers } from "../hooks/useMasterUsers";
import { useMasterVideos } from "../hooks/useMasterVideos";
import { useMasterPayments } from "../hooks/useMasterPayments";
import { useMasterWithdrawals } from "../hooks/useMasterWithdrawals";
import { useMasterSettings } from "../hooks/useMasterSettings";

interface MasterDashboardProps {
  defaultTab?: MasterTab;
}

export default function MasterDashboard({ defaultTab }: MasterDashboardProps = {}) {
  const { user, roleData, signOut } = useAuth();

  // Authentication check: Either supabase user is master, or master_token is in localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem("master_token");
    const isMasterRole =
      roleData?.is_master === true ||
      roleData?.role === "master" ||
      roleData?.role === "MASTER_ADMIN" ||
      user?.email === "master@paytune.com";
    return !!token || isMasterRole;
  });

  useEffect(() => {
    const token = localStorage.getItem("master_token");
    const isMasterRole =
      roleData?.is_master === true ||
      roleData?.role === "master" ||
      roleData?.role === "MASTER_ADMIN" ||
      user?.email === "master@paytune.com";
    if (token || isMasterRole) {
      setIsAuthenticated(true);
    }
  }, [user, roleData]);

  // Tab State
  const [activeTab, setActiveTab] = useState<MasterTab>(() => {
    if (defaultTab) return defaultTab;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as MasterTab;
    if (
      tabParam &&
      [
        "overview",
        "artists",
        "users",
        "videos",
        "payments",
        "withdrawals",
        "copyright",
        "settings",
        "reports",
        "logs",
        "diagnostics"
      ].includes(tabParam)
    ) {
      return tabParam;
    }
    return "overview";
  });

  // Impersonation State
  const [impersonatingArtist, setImpersonatingArtist] = useState<{ id: string; name: string; email?: string } | null>(() => {
    try {
      const stored = localStorage.getItem("impersonate_artist_data");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Data Hooks
  const {
    stats,
    revenue,
    revenuePeriod,
    changeRevenuePeriod,
    activities,
    topContent,
    loading: statsLoading,
    refreshStats
  } = useMasterStats();

  const {
    artists,
    total: artistsTotal,
    loading: artistsLoading,
    error: artistsError,
    statusFilter: artistStatusFilter,
    setStatusFilter: setArtistStatusFilter,
    searchQuery: artistSearchQuery,
    setSearchQuery: setArtistSearchQuery,
    sortBy: artistSortBy,
    setSortBy: setArtistSortBy,
    selectedIds: artistSelectedIds,
    toggleSelectArtist,
    selectAll: selectAllArtists,
    autoApproveActive,
    approveArtist,
    blockArtist,
    unblockArtist,
    deleteArtist,
    impersonateArtist,
    bulkAction: bulkArtistAction,
    toggleAutoApprove: toggleArtistAutoApprove,
    refreshArtists
  } = useMasterArtists();

  const {
    users,
    total: usersTotal,
    loading: usersLoading,
    error: usersError,
    statusFilter: userStatusFilter,
    setStatusFilter: setUserStatusFilter,
    searchQuery: userSearchQuery,
    setSearchQuery: setUserSearchQuery,
    sortBy: userSortBy,
    setSortBy: setUserSortBy,
    selectedIds: userSelectedIds,
    toggleSelectUser,
    blockUser,
    unblockUser,
    deleteUser,
    refreshUsers
  } = useMasterUsers();

  const {
    videos,
    total: videosTotal,
    loading: videosLoading,
    error: videosError,
    visibilityFilter: videoVisibilityFilter,
    setVisibilityFilter: setVideoVisibilityFilter,
    typeFilter: videoTypeFilter,
    setTypeFilter: setVideoTypeFilter,
    searchQuery: videoSearchQuery,
    setSearchQuery: setVideoSearchQuery,
    sortBy: videoSortBy,
    setSortBy: setVideoSortBy,
    updateVideo,
    deleteVideo,
    refreshVideos
  } = useMasterVideos();

  const {
    payments,
    total: paymentsTotal,
    loading: paymentsLoading,
    error: paymentsError,
    methodFilter: paymentMethodFilter,
    setMethodFilter: setPaymentMethodFilter,
    dateFrom: paymentDateFrom,
    setDateFrom: setPaymentDateFrom,
    dateTo: paymentDateTo,
    setDateTo: setPaymentDateTo,
    refundPayment,
    exportCSV: exportPaymentsCSV,
    refreshPayments
  } = useMasterPayments();

  const {
    withdrawals,
    total: withdrawalsTotal,
    loading: withdrawalsLoading,
    error: withdrawalsError,
    statusFilter: withdrawalStatusFilter,
    setStatusFilter: setWithdrawalStatusFilter,
    selectedIds: withdrawalSelectedIds,
    processingId: withdrawalProcessingId,
    toggleSelectWithdrawal,
    selectAllPending: selectAllPendingWithdrawals,
    processWithdrawal,
    batchProcess: batchProcessWithdrawals,
    refreshWithdrawals
  } = useMasterWithdrawals();

  const {
    settings,
    loading: settingsLoading,
    saving: settingsSaving,
    error: settingsError,
    saveSuccess: settingsSaveSuccess,
    updateSettings,
    updateTemplates,
    refreshSettings
  } = useMasterSettings();

  // Handle Impersonation
  const handleStartImpersonate = async (artistId: string) => {
    const artist = artists.find(a => a.id === artistId);
    if (!artist) return;

    try {
      await impersonateArtist(artistId);
      const artistData = { id: artist.id, name: artist.name, email: artist.email };
      localStorage.setItem("impersonate_artist_data", JSON.stringify(artistData));
      setImpersonatingArtist(artistData);

      // Ask if user wants to open the artist studio directly
      if (window.confirm(`Impersonation active for ${artist.name}. Do you want to open the Artist Studio dashboard now?`)) {
        window.open("/artist/dashboard", "_blank");
      }
    } catch (e) {
      console.error("Failed to impersonate:", e);
    }
  };

  const handleExitImpersonation = () => {
    localStorage.removeItem("impersonate_token");
    localStorage.removeItem("impersonate_artist_data");
    setImpersonatingArtist(null);
  };

  // Handle Master Logout
  const handleLogout = async () => {
    localStorage.removeItem("master_token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("impersonate_token");
    localStorage.removeItem("impersonate_artist_data");
    setIsAuthenticated(false);
    if (signOut) {
      await signOut();
    }
    window.location.href = "/master-admin/login";
  };

  // If not authenticated, render MasterLogin directly
  if (!isAuthenticated) {
    return (
      <MasterLogin
        onSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const pendingApprovalsCount = stats?.pending_approvals ?? artists.filter(a => a.status === "pending").length;
  const pendingWithdrawalsCount = stats?.pending_withdrawals ?? withdrawals.filter(w => (w.status || "pending") === "pending").length;

  return (
    <div className="relative min-h-screen">
      {/* Impersonation Banner if active */}
      {impersonatingArtist && (
        <MasterImpersonateBanner
          artistName={impersonatingArtist.name}
          artistEmail={impersonatingArtist.email}
          onExit={handleExitImpersonation}
        />
      )}

      {/* Main Master Layout */}
      <MasterDashboardLayout
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab);
          const url = new URL(window.location.href);
          url.searchParams.set("tab", tab);
          window.history.pushState({}, "", url.toString());
        }}
        pendingApprovals={pendingApprovalsCount}
        pendingWithdrawals={pendingWithdrawalsCount}
        autoApproveActive={autoApproveActive}
        onToggleAutoApprove={() => toggleArtistAutoApprove(false)}
        onLogout={handleLogout}
      >
        {activeTab === "overview" && (
          <MasterOverview
            stats={stats}
            revenue={revenue}
            revenuePeriod={revenuePeriod}
            onChangePeriod={changeRevenuePeriod}
            activities={activities}
            topContent={topContent}
            loading={statsLoading}
            onNavigateTab={tab => setActiveTab(tab)}
            onQuickApproveAll={async () => {
              await bulkArtistAction("approve");
              refreshStats();
              refreshArtists();
            }}
            onBatchProcessWithdrawals={async () => {
              selectAllPendingWithdrawals();
              await batchProcessWithdrawals();
              refreshStats();
              refreshWithdrawals();
            }}
            onToggleAutoApprove={() => toggleArtistAutoApprove(false)}
          />
        )}

        {activeTab === "artists" && (
          <ArtistManagement
            artists={artists}
            total={artistsTotal}
            loading={artistsLoading}
            error={artistsError}
            statusFilter={artistStatusFilter}
            setStatusFilter={setArtistStatusFilter}
            searchQuery={artistSearchQuery}
            setSearchQuery={setArtistSearchQuery}
            sortBy={artistSortBy}
            setSortBy={setArtistSortBy}
            selectedIds={artistSelectedIds}
            toggleSelectArtist={toggleSelectArtist}
            selectAll={selectAllArtists}
            autoApproveActive={autoApproveActive}
            onApprove={async id => {
              await approveArtist(id);
              refreshStats();
            }}
            onBlock={blockArtist}
            onUnblock={unblockArtist}
            onDelete={async id => {
              await deleteArtist(id);
              refreshStats();
            }}
            onImpersonate={handleStartImpersonate}
            onBulkAction={async act => {
              await bulkArtistAction(act);
              refreshStats();
            }}
            onToggleAutoApprove={toggleArtistAutoApprove}
          />
        )}

        {activeTab === "users" && (
          <UserManagement
            users={users}
            total={usersTotal}
            loading={usersLoading}
            error={usersError}
            statusFilter={userStatusFilter}
            setStatusFilter={setUserStatusFilter}
            searchQuery={userSearchQuery}
            setSearchQuery={setUserSearchQuery}
            sortBy={userSortBy}
            setSortBy={setUserSortBy}
            selectedIds={userSelectedIds}
            toggleSelectUser={toggleSelectUser}
            onBlock={blockUser}
            onUnblock={unblockUser}
            onDelete={async id => {
              await deleteUser(id);
              refreshStats();
            }}
          />
        )}

        {activeTab === "videos" && (
          <VideoManagement
            videos={videos}
            total={videosTotal}
            loading={videosLoading}
            error={videosError}
            visibilityFilter={videoVisibilityFilter}
            setVisibilityFilter={setVideoVisibilityFilter}
            typeFilter={videoTypeFilter}
            setTypeFilter={setVideoTypeFilter}
            searchQuery={videoSearchQuery}
            setSearchQuery={setVideoSearchQuery}
            sortBy={videoSortBy}
            setSortBy={setVideoSortBy}
            onUpdateVideo={updateVideo}
            onDeleteVideo={async id => {
              await deleteVideo(id);
              refreshStats();
            }}
          />
        )}

        {activeTab === "ads" && <MasterAdsManager />}

        {activeTab === "payments" && (
          <PaymentManagement
            payments={payments}
            total={paymentsTotal}
            loading={paymentsLoading}
            error={paymentsError}
            methodFilter={paymentMethodFilter}
            setMethodFilter={setPaymentMethodFilter}
            dateFrom={paymentDateFrom}
            setDateFrom={setPaymentDateFrom}
            dateTo={paymentDateTo}
            setDateTo={setPaymentDateTo}
            onRefund={async id => {
              await refundPayment(id);
              refreshStats();
            }}
            onExportCSV={exportPaymentsCSV}
          />
        )}

        {activeTab === "withdrawals" && (
          <WithdrawalManagement
            withdrawals={withdrawals}
            total={withdrawalsTotal}
            loading={withdrawalsLoading}
            error={withdrawalsError}
            statusFilter={withdrawalStatusFilter}
            setStatusFilter={setWithdrawalStatusFilter}
            selectedIds={withdrawalSelectedIds}
            processingId={withdrawalProcessingId}
            toggleSelectWithdrawal={toggleSelectWithdrawal}
            selectAllPending={selectAllPendingWithdrawals}
            onProcessWithdrawal={async id => {
              await processWithdrawal(id);
              refreshStats();
            }}
            onBatchProcess={async () => {
              await batchProcessWithdrawals();
              refreshStats();
            }}
          />
        )}

        {activeTab === "copyright" && <MasterCopyrightCenter />}

        {activeTab === "settings" && (
          <MasterSettings
            settings={settings}
            loading={settingsLoading}
            saving={settingsSaving}
            error={settingsError}
            saveSuccess={settingsSaveSuccess}
            onUpdateSettings={async s => {
              await updateSettings(s);
              refreshStats();
            }}
            onUpdateTemplates={updateTemplates}
          />
        )}

        {activeTab === "reports" && <MasterReports />}

        {activeTab === "logs" && <AdminLogs />}

        {activeTab === "diagnostics" && <MasterDiagnostics />}
      </MasterDashboardLayout>
    </div>
  );
}
