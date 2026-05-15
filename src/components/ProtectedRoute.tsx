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

export const AuthGateFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface-primary)] px-6 text-center text-gray-900 dark:text-white">
    <div className="w-full max-w-sm">
      <div
        className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 dark:border-purple-900/70 dark:border-t-purple-300"
        aria-hidden="true"
      />
      <div className="text-base font-semibold">Checking your session</div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        We are confirming whether this private page is available to you.
      </p>
    </div>
  </div>
);

export const RequireAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const location = useLocation();

  if (loading && !profile) {
    return <AuthGateFallback />;
  }

  // If definitely NOT authenticated, redirect immediately
  // This uses both isAuthenticated flag and profile check for robustness
  if (!isAuthenticated || !profile) {
    // Preserve the attempted URL for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
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
