import React, { useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import Profile from '@/pages/catalog/BrandProfile';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';

export const ProfileLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const location = useLocation();
  const mainContentMarginClass = 'lg:ml-[64px]';

  if (user && user.type !== 'BRAND') {
    return <Navigate to="/" replace />;
  }

  if (loading && !user) {
    return (
        <div className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
          <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
          <Navbar isCollapsed={isCollapsed} onToggleSidebar={() => setIsCollapsed((v) => !v)} />
          <main
            className={`pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out ${mainContentMarginClass}`}
          >
            <div className="p-4 sm:p-6">
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
      <div 
        className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
        style={{
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: CSS custom prop
          ['--sidebar-width' as any]: isCollapsed ? '64px' : '192px',
        }}
      >
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <Navbar isCollapsed={isCollapsed} onToggleSidebar={() => setIsCollapsed((v) => !v)} />
        <main className={`pt-0 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out lg:ml-[var(--sidebar-width)]`}>
          <div className="p-0 sm:p-2">
            {location.pathname === '/profile' ? <Profile /> : <Outlet />}
          </div>
        </main>
      </div>
  );
};
