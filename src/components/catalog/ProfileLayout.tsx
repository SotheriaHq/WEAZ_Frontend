import React from 'react';
import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';
import Profile from '../../pages/catalog/Catalog';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/context/AuthContext';
import { closeSidebar, selectIsMobile, setSidebarMode } from '@/features/uiSlice';
import type { AppDispatch, RootState } from '@/store';
import { useLocation, Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect, useMemo } from 'react';

const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  if (isMobile) return 'HIDDEN' as const;
  if (pathname.startsWith('/settings') || pathname.startsWith('/profile/settings')) return 'HIDDEN' as const;
  if (pathname.startsWith('/studio')) return 'HIDDEN' as const;
  return 'RAIL' as const;
};

export const ProfileLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const isMobile = useSelector(selectIsMobile);
  const location = useLocation();
  const { id: routeBrandId } = useParams<{ id?: string }>();

  const isVisitorRoute = Boolean(routeBrandId);

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/settings') || location.pathname.startsWith('/profile/settings') || location.pathname.startsWith('/studio');

  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  const isRail = computedSidebarMode === 'RAIL';
  const mainMarginLeft = isRail ? '72px' : '0px';

  if (!isVisitorRoute) {
    if (user && user.type !== 'BRAND') {
      return <Navigate to="/" replace />;
    }

    if (loading && !user) {
      return (
          <div className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:from-[#0f0f0f] dark:via-[#0a0a0a] dark:to-[#000000] text-gray-900 dark:text-white">
            {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen) && <Sidebar />}
            <Navbar />
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

    // Store onboarding is encouraged/deferrable (no hard redirect).
  }

  return (
      <div 
        className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:from-[#0f0f0f] dark:via-[#0a0a0a] dark:to-[#000000] text-gray-900 dark:text-white"
      >
        {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen) && <Sidebar />}
        <Navbar />
        <main 
          className="pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out"
          style={{ marginLeft: mainMarginLeft }}
        >
          <div className="p-0 sm:p-2">
            {location.pathname === '/profile' ? <Profile /> : <Outlet />}
          </div>
        </main>

        {/* Backdrop for OVERLAY mode */}
        {isSidebarOpen && !isRouteSidebarHidden && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={() => dispatch(closeSidebar())}
            aria-hidden="true"
          />
        )}
      </div>
  );
};
