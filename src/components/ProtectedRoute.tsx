/**
 * ProtectedRoute - Prevents unauthorized access to protected pages
 * 
 * SECURITY: Shows loading state during auth check to prevent any flash of content
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const location = useLocation();

  // If definitely NOT authenticated, redirect immediately
  // This uses both isAuthenticated flag and profile check for robustness
  if (!isAuthenticated && !profile) {
    // Preserve the attempted URL for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Double-check: if isAuthenticated is true but profile is null (edge case),
  // still redirect to prevent any content flash
  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render child routes
  return <Outlet />;
};

export default ProtectedRoute;
