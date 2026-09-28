import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  role?: 'user' | 'artist' | 'admin' | 'master';
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role, redirectTo = '/login' }) => {
  const { user, roleData, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white font-black uppercase tracking-widest">Loading Stage...</div>;

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  const isArtist = 
    roleData?.momo_code !== undefined || 
    roleData?.phone !== undefined || 
    user?.user_metadata?.role === 'artist';

  const isMaster = 
    roleData?.is_master === true || 
    roleData?.role === 'master' || 
    roleData?.role === 'MASTER_ADMIN' ||
    user?.user_metadata?.role === 'MASTER_ADMIN' ||
    user?.app_metadata?.role === 'MASTER_ADMIN' ||
    user?.email === 'master@paytune.com';

  if (role === 'artist') {
    if (!isArtist) {
      return <Navigate to="/artist/login" replace />;
    }
    // If phone is not verified, redirect to phone verification
    if (roleData?.phone_verified === false) {
      return <Navigate to="/artist/verify-phone" replace />;
    }
  }

  if ((role === 'master' || role === 'admin') && !isMaster) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};
