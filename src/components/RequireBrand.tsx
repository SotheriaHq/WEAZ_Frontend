import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { getStoredAccessToken } from '../api/httpClient';

interface RequireBrandProps {
  children?: React.ReactNode;
}

const RequireBrand: React.FC<RequireBrandProps> = ({ children }) => {
  const { profile: user } = useSelector((state: RootState) => state.user);

  if (!user) {
    // If not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // If we have a token but the persisted user is stale/partial, wait for AuthProvider
  // to hydrate the real profile rather than redirecting incorrectly.
  if (user.type !== 'BRAND') {
    const token = getStoredAccessToken();
    if (token && (user.type as any) == null) {
      return (
        <div className="flex items-center justify-center min-h-[240px]">
          <div className="text-sm text-gray-500">Loading your brand dashboard…</div>
        </div>
      );
    }

    // If not a brand account, redirect to home
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireBrand;
