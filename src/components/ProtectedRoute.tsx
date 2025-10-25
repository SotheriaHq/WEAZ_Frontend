
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const ProtectedRoute: React.FC = () => {
  const { profile: user } = useSelector((state: RootState) => state.user);

  // If user is authenticated (profile exists), redirect to home
  if (user) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
