/**
 * ProtectedRoute - Prevents unauthorized access to protected pages
 * 
 * SECURITY: Shows loading state during auth check to prevent any flash of content
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useAuth } from '@/context/AuthContext';
import VLoader from '@/components/loaders/VLoader';

export const AuthGateFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
    <VLoader size={56} phase="loading" showLabel={false} />
  </div>
);

export const RequireAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const location = useLocation();

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loading) {
    return <AuthGateFallback />;
  }

  return <>{children}</>;
};

const ProtectedRoute: React.FC = () => {
  // User is authenticated, render child routes
  // RequireAuthenticated handles loading, stale sessions, and redirect state.
  return (
    <RequireAuthenticated>
      <Outlet />
    </RequireAuthenticated>
  );
};

export default ProtectedRoute;
