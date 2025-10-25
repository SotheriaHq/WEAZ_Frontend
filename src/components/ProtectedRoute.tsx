
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import getProfileOrHomeUrl from '../lib/navigation';

const ProtectedRoute: React.FC = () => {
  const { profile: user } = useSelector((state: RootState) => state.user);

  // If user is authenticated (profile exists), redirect to proper landing
  if (user) {
    return <Navigate to={getProfileOrHomeUrl(user)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
