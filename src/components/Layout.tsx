import React, { useEffect, useMemo } from 'react';
import { Sidebar } from './SideBar';
import { Navbar } from './Navbar';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';
import { setSidebarMode, closeSidebar, selectIsMobile } from '@/features/uiSlice';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';

interface LayoutProps {
  children?: React.ReactNode;
}

/**
 * Compute the correct sidebar mode based on route and viewport
 * This is called synchronously to avoid render flashes
 */
const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  // Mobile always hides sidebar
  if (isMobile) return 'HIDDEN' as const;
  
  // Settings page has its own sidebar
  if (pathname.startsWith('/settings')) return 'HIDDEN' as const;
  
  // Studio pages hide the rail
  if (pathname.startsWith('/studio')) return 'HIDDEN' as const;
  
  // Default to RAIL for desktop
  return 'RAIL' as const;
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';
  
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const isMobile = useSelector(selectIsMobile);

  // Mount global notifications bootstrap once.
  useNotificationsBootstrap();

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/studio') || isEmbeddedMobile;

  // Update sidebar mode when route or viewport changes
  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  // Calculate margins based on mode
  // RAIL: 72px left margin, HIDDEN: 0px left margin
  const mainMarginLeft = !isEmbeddedMobile && computedSidebarMode === 'RAIL' ? '72px' : '0px';

  return (
    <div className="min-h-screen threadly-shell-bg text-gray-900 dark:text-white">
        
      {/* Navbar */}
      {!isEmbeddedMobile ? <Navbar /> : null}

      {/* Sidebar */}
      {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
       
      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-[margin] duration-300 ease-out ${isEmbeddedMobile ? 'pb-4 pt-0' : 'pb-20 pt-16 md:pb-8'}`}
        style={{ marginLeft: mainMarginLeft }}
      >
        {/* will-change removed from main — it was promoting the entire page to
            its own GPU layer permanently, holding significant memory even when
            not animating. The transition-[margin] is infrequent enough that
            the browser handles it fine without a persistent compositing layer. */}
        <div className="px-0 sm:px-2">
          {children || <Outlet />}
        </div>
      </main>

    </div>
  );
};

