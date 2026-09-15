import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import getProfileOrHomeUrl from '../lib/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthGateFallback } from '@/components/AuthGateFallback';

const GuestRoute: React.FC = () => {
  const { profile: user } = useSelector((state: RootState) => state.user);
  const { loading } = useAuth();

  if (loading) {
    return <AuthGateFallback fullScreen />;
  }

  // If user is authenticated, redirect to their profile/home
  if (user) {
    return <Navigate to={getProfileOrHomeUrl(user)} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
