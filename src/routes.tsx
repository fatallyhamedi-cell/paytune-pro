import { Routes, Route, Navigate } from 'react-router-dom';
import ArtistRegister from './pages/Artist/Register';
import ArtistLogin from './pages/Artist/Login';
import ArtistProtectedRoute from './components/ArtistProtectedRoute';
import ArtistDashboardLayout from './components/ArtistDashboardLayout';
import ArtistDashboard from './pages/Artist/Dashboard';
import ArtistVideos from './pages/Artist/Videos';
import ArtistAnalytics from './pages/Artist/Analytics';
import ArtistEarnings from './pages/Artist/Earnings';
import ArtistFollowers from './pages/Artist/Followers';
import ArtistProfile from './pages/Artist/Profile';
import ArtistUpload from './pages/Artist/Upload';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/artist/signup" element={<ArtistRegister />} />
      <Route path="/artist/register" element={<ArtistRegister />} />
      <Route path="/artist/login" element={<ArtistLogin />} />
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
      </Route>
      <Route path="/artist" element={<Navigate to="/artist/dashboard" replace />} />
    </Routes>
  );
}

export {
  ArtistRegister,
  ArtistLogin,
  ArtistDashboard,
  ArtistVideos,
  ArtistUpload,
  ArtistAnalytics,
  ArtistEarnings,
  ArtistFollowers,
  ArtistProfile,
};
