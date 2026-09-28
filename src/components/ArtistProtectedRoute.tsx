import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useArtistAuth } from '../contexts/ArtistAuthContext';

export default function ArtistProtectedRoute({ children }: { children: React.ReactNode }) {
  const { artist, loading } = useArtistAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return <Navigate to="/artist/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
