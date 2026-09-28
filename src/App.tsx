import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { ArtistAuthProvider } from "./contexts/ArtistAuthContext";
import { MasterAuthProvider } from "./contexts/MasterAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ArtistProtectedRoute from "./components/ArtistProtectedRoute";
import ArtistDashboardLayout from "./components/ArtistDashboardLayout";
import { ConfigBanner } from "./components/ConfigBanner";

// Lazy-loaded routes for code splitting and instant initial page load
const Auth = lazy(() => import("./pages/Auth"));
const ArtistRegister = lazy(() => import("./pages/Artist/Register"));
const ArtistLogin = lazy(() => import("./pages/Artist/Login"));
const ArtistVerifyPhone = lazy(() => import("./pages/ArtistVerifyPhone"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ArtistDashboard = lazy(() => import("./pages/Artist/Dashboard"));
const ArtistVideos = lazy(() => import("./pages/Artist/Videos"));
const ArtistUpload = lazy(() => import("./pages/Artist/Upload"));
const ArtistAnalytics = lazy(() => import("./pages/Artist/Analytics"));
const ArtistEarnings = lazy(() => import("./pages/Artist/Earnings"));
const ArtistFollowers = lazy(() => import("./pages/Artist/Followers"));
const ArtistProfile = lazy(() => import("./pages/Artist/Profile"));
const VideoUpload = lazy(() => import("./pages/VideoUpload"));
const Earnings = lazy(() => import("./pages/Earnings"));
const MasterDashboard = lazy(() => import("./pages/MasterDashboard"));
const MasterAdminLogin = lazy(() => import("./pages/MasterAdminLogin"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const LiveStreams = lazy(() => import("./pages/live/LiveStreams"));
const LiveWatch = lazy(() => import("./pages/live/LiveWatch"));
const LiveDashboard = lazy(() => import("./pages/Artist/LiveDashboard"));
const MembershipDashboard = lazy(() => import("./pages/Artist/MembershipDashboard"));
const Shorts = lazy(() => import("./pages/Shorts"));
const LegalPages = lazy(() => import("./pages/LegalPages"));
const Guides = lazy(() => import("./pages/Guides"));
const ArtistChannel = lazy(() => import("./pages/ArtistChannel"));
const DMCA = lazy(() => import("./pages/DMCA"));
const CopyrightHolderPortal = lazy(() => import("./pages/CopyrightHolderPortal"));
const SearchPage = lazy(() => import("./pages/Search"));
const TrendingPage = lazy(() => import("./pages/Trending"));
const FeedPage = lazy(() => import("./pages/Feed"));

const RouteLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
    <span className="text-xs text-amber-500/80 font-mono tracking-wider">LOADING PAYTUNE...</span>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ArtistAuthProvider>
            <MasterAuthProvider>
              <CurrencyProvider>
                <BrowserRouter>
                <ConfigBanner />
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                  {/* Public Website */}
                  <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/shorts" element={<Shorts />} />
                    <Route path="/shorts/:id" element={<Shorts />} />
                    <Route path="/watch/:id" element={<Watch />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/feed" element={<FeedPage />} />
                    <Route path="/live" element={<LiveStreams />} />
                    <Route path="/live/:streamId" element={<LiveWatch />} />
                    <Route path="/legal" element={<LegalPages />} />
                    <Route path="/guides" element={<Guides />} />
                    <Route path="/dmca" element={<DMCA />} />
                    <Route path="/copyright-portal" element={<CopyrightHolderPortal />} />
                    <Route path="/copyright/holder" element={<CopyrightHolderPortal />} />
                    <Route path="/artist/:id" element={<ArtistChannel />} />
                    
                    {/* Protected User Routes */}
                    <Route element={<ProtectedRoute />}>
                       <Route path="/dashboard/*" element={<Dashboard />} />
                    </Route>

                    {/* Protected Master Administrator Routes */}
                    <Route element={<ProtectedRoute role="master" redirectTo="/master-admin/login" />}>
                       <Route path="/master/dashboard" element={<MasterDashboard />} />
                       <Route path="/master/settings" element={<MasterDashboard defaultTab="settings" />} />
                       <Route path="/master-admin/dashboard" element={<Navigate to="/master/dashboard" replace />} />
                    </Route>
                  </Route>

                  {/* Hidden Master Admin Login Terminal */}
                  <Route path="/master-admin/login" element={<MasterAdminLogin />} />
                  <Route path="/master-admin" element={<Navigate to="/master-admin/login" replace />} />

                  {/* Independent Auth Pages */}
                  <Route path="/login" element={<Navigate to="/auth" replace />} />
                  <Route path="/signup" element={<Navigate to="/auth?tab=signup" replace />} />
                  <Route path="/auth" element={<Auth />} />

                  {/* Artist Authentication Routes */}
                  <Route path="/auth/artist" element={<ArtistLogin />} />
                  <Route path="/artist/login" element={<ArtistLogin />} />
                  <Route path="/artist/signup" element={<ArtistRegister />} />
                  <Route path="/artist/register" element={<ArtistRegister />} />
                  <Route path="/artist/verify-phone" element={<ArtistVerifyPhone />} />
                  <Route path="/signup/artist" element={<ArtistRegister />} />

                  {/* Artist Studio System (Dedicated Layout & Custom Artist JWT Protection) */}
                  <Route
                    path="/artist/dashboard"
                    element={
                      <ArtistProtectedRoute>
                        <ArtistDashboardLayout />
                      </ArtistProtectedRoute>
                    }
                  >
                    <Route index element={<ArtistDashboard />} />
                    <Route path="videos" element={<ArtistVideos />} />
                    <Route path="upload" element={<ArtistUpload />} />
                    <Route path="analytics" element={<ArtistAnalytics />} />
                    <Route path="earnings" element={<ArtistEarnings />} />
                    <Route path="followers" element={<ArtistFollowers />} />
                    <Route path="profile" element={<ArtistProfile />} />
                    <Route path="live" element={<LiveDashboard />} />
                    <Route path="membership" element={<MembershipDashboard />} />
                  </Route>

                  {/* Direct Artist URLs for Quick Access */}
                  <Route path="/artist/videos" element={<Navigate to="/artist/dashboard/videos" replace />} />
                  <Route path="/artist/upload" element={<Navigate to="/artist/dashboard/upload" replace />} />
                  <Route path="/artist/earnings" element={<Navigate to="/artist/dashboard/earnings" replace />} />
                  <Route path="/artist/analytics" element={<Navigate to="/artist/dashboard/analytics" replace />} />
                  <Route path="/artist/followers" element={<Navigate to="/artist/dashboard/followers" replace />} />
                  <Route path="/artist/profile" element={<Navigate to="/artist/dashboard/profile" replace />} />
                  <Route path="/artist/settings" element={<Navigate to="/artist/dashboard/profile" replace />} />
                  <Route path="/artist" element={<Navigate to="/artist/dashboard" replace />} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </CurrencyProvider>
        </MasterAuthProvider>
      </ArtistAuthProvider>
      </AuthProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
