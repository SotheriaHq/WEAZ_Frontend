/**
 * ProtectedRoute - Prevents unauthorized access to protected pages.
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useAuth } from '@/context/AuthContext';
import { AuthGateFallback } from '@/components/AuthGateFallback';

/** Shared with GuestRoute: delayed skeleton, no words. */
const AuthRouteFallback: React.FC = () => <AuthGateFallback />;

export const RequireAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthRouteFallback />;
  }

  if (!isAuthenticated || !profile) {
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
