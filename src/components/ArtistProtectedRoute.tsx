import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useArtistAuth } from '../contexts/ArtistAuthContext';
import { useAuth } from '../hooks/useAuth';

export default function ArtistProtectedRoute({ children }: { children: React.ReactNode }) {
  const { artist, loading: artistLoading } = useArtistAuth();
  const { roleData, loading: authLoading } = useAuth();
  const location = useLocation();

  if (artistLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasArtistRole = Boolean(artist || roleData?.role === 'artist');

  if (!hasArtistRole) {
    return <Navigate to="/artist/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
