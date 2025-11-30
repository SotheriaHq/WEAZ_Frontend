import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import getProfileOrHomeUrl from '../lib/navigation';

const GuestRoute: React.FC = () => {
  const { profile: user } = useSelector((state: RootState) => state.user);

  // If user is authenticated, redirect to their profile/home
  if (user) {
    return <Navigate to={getProfileOrHomeUrl(user)} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
