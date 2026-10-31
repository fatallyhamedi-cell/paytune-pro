import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function MasterProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  // Check localStorage directly
  const token = localStorage.getItem('master_token');
  const role = localStorage.getItem('role');

  console.log('Master Guard - Token:', !!token, 'Role:', role); // Debug log

  if (!token || (role !== 'master' && role !== 'MASTER_ADMIN')) {
    // If not authorized, kick them back to Master Login
    return <Navigate to="/master/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
