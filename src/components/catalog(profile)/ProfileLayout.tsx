import React, { useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';

export const ProfileLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const location = useLocation();
  const mainContentMarginClass = isCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[192px]';

  if (user && user.type !== 'BRAND') {
    return <Navigate to="/" replace />;
  }

  if (loading && !user) {
    return (
        <div className="h-screen flex bg-white dark:bg-[#000000] text-gray-900 dark:text-black">
          <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
          <Navbar isCollapsed={isCollapsed} minimal />
          <main
            className={`flex-1 overflow-hidden transition-all duration-300 ${mainContentMarginClass}`}
          >
            <div className="h-full p-4 sm:p-6 pb-20 lg:pb-8 pt-20 overflow-y-auto">
              <div className="max-w-screen-xl mx-auto space-y-6">
                <ProfileHeaderSkeleton />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-3">
                    <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
                  </div>
                  <div className="lg:col-span-9">
                    <CollectionsSkeleton />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
      <div className="h-screen flex bg-white dark:bg-[#000000] text-gray-900 dark:text-black">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <Navbar isCollapsed={isCollapsed} minimal />
        <main className={`flex-1 overflow-hidden transition-all duration-300 ${mainContentMarginClass}`}>
          <div className="h-full p-4 sm:p-6 pb-20 lg:pb-8 pt-20 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
  );
};
