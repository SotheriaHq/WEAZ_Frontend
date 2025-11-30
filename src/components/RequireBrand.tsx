import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

interface RequireBrandProps {
  children?: React.ReactNode;
}

const RequireBrand: React.FC<RequireBrandProps> = ({ children }) => {
  const { profile: user } = useSelector((state: RootState) => state.user);

  if (!user) {
    // If not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (user.type !== 'BRAND') {
    // If not a brand account, redirect to profile/home
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireBrand;
