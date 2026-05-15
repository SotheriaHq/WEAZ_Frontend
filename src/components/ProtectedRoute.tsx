/**
 * ProtectedRoute - Prevents unauthorized access to protected pages.
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export const RequireAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const location = useLocation();

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render from the existing signed-in profile while AuthProvider revalidates
  // in the background. If the server rejects the session, AuthProvider clears
  // the profile and this guard redirects on the next render.
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
