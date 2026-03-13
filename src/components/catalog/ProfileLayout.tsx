import React, { lazy } from 'react';
import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';
import { EndUserProfile } from '../../pages/profile/EndUserProfile';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/context/AuthContext';
import { closeSidebar, selectIsMobile, setSidebarMode } from '@/features/uiSlice';
import type { AppDispatch, RootState } from '@/store';
import { useLocation, Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/httpClient';

const Profile = lazy(() => import('../../pages/catalog/Catalog'));

const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  const isProfileRoute = pathname === '/profile' || pathname.startsWith('/profile/');
  if (isProfileRoute && !pathname.startsWith('/profile/settings')) return 'RAIL' as const;
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
  const [visitorType, setVisitorType] = useState<'BRAND' | 'REGULAR' | null>(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/studio');

  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisitorRoute || !routeBrandId) return;
      try {
        setVisitorLoading(true);
        const res = await apiClient.get(`/users/${routeBrandId}/profile/public`);
        const payload = res.data?.data ?? res.data;
        const source = payload?.user ?? payload?.profile ?? payload;
        const rawType = source?.type as string | undefined;
        const type =
          rawType === 'BRAND' || rawType === 'REGULAR'
            ? rawType
            : source?.role === 'User'
              ? 'REGULAR'
              : null;
        if (mounted) {
          setVisitorType(type ?? null);
        }
      } catch {
        if (mounted) {
          setVisitorType(null);
        }
      } finally {
        if (mounted) {
          setVisitorLoading(false);
        }
      }
    };
    void run();
    return () => { mounted = false; };
  }, [isVisitorRoute, routeBrandId]);

  const isRail = computedSidebarMode === 'RAIL';
  const mainMarginLeft = isRail ? '72px' : '0px';

  if (!isVisitorRoute) {
    if (loading && !user) {
      return (
          <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
            {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
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

  if (isVisitorRoute && visitorLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
        {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
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

  return (
      <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
        {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
        <Navbar />
        <main
          className="pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out"
          style={{ marginLeft: mainMarginLeft }}
        >
          <div className="p-0 sm:p-2">
            {location.pathname === '/profile' ? (
              user?.type === 'BRAND' ? <Profile /> : <EndUserProfile />
            ) : isVisitorRoute && routeBrandId && location.pathname === `/profile/${routeBrandId}` ? (
              visitorType === 'BRAND' ? <Profile /> : <EndUserProfile />
            ) : (
              <Outlet />
            )}
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
