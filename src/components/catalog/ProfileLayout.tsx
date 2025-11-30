

import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';
import Profile from '../../pages/catalog/Catalog';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/context/AuthContext';
import { toggleSidebar, closeSidebar } from '@/features/uiSlice';
import type { AppDispatch, RootState } from '@/store';
import { useLocation, Navigate, Outlet } from 'react-router-dom';

export const ProfileLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const location = useLocation();

  // Determine effective sidebar state (similar to Layout.tsx)
  const isRail = sidebarMode === 'RAIL';
  const mainMarginLeft = isRail ? '72px' : '0px';

  if (user && user.type !== 'BRAND') {
    return <Navigate to="/" replace />;
  }

  if (loading && !user) {
    return (
        <div className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
          <Sidebar />
          <Navbar isCollapsed={isRail} onToggleSidebar={() => dispatch(toggleSidebar())} />
          <main
            className="pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out"
            style={{ marginLeft: mainMarginLeft }}
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
      >
        <Sidebar />
        <Navbar isCollapsed={isRail} onToggleSidebar={() => dispatch(toggleSidebar())} />
        <main 
          className="pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out"
          style={{ marginLeft: mainMarginLeft }}
        >
          <div className="p-0 sm:p-2">
            {location.pathname === '/profile' ? <Profile /> : <Outlet />}
          </div>
        </main>

        {/* Backdrop for OVERLAY mode */}
        {isSidebarOpen && (sidebarMode === 'OVERLAY' || sidebarMode === 'HIDDEN' || sidebarMode === 'RAIL' || window.innerWidth < 1024) && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={() => dispatch(closeSidebar())}
            aria-hidden="true"
          />
        )}
      </div>
  );
};
