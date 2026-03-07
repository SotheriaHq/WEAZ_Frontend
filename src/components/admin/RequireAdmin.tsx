import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useAuth } from '@/context/AuthContext';

const RequireAdmin: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { profile: user } = useSelector((state: RootState) => state.user);
  const { loading } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: '/admin' }} replace />;
  }

  // Wait for auth hydration before making role decisions
  if (loading && !user.role) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="text-sm text-gray-500">Loading admin console...</div>
      </div>
    );
  }

  if (user.role !== 'SuperAdmin' && user.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  if (
    user.mustResetPassword === true &&
    location.pathname !== '/admin/reset-password'
  ) {
    return <Navigate to="/admin/reset-password" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireAdmin;
