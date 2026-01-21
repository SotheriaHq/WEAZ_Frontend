import React, { useEffect, useMemo } from 'react';
import { Sidebar } from './SideBar';
import { Navbar } from './Navbar';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';
import { setSidebarMode, closeSidebar, selectIsMobile } from '@/features/uiSlice';
import GlassBackdrop from './ui/GlassBackdrop';

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
  
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const isMobile = useSelector(selectIsMobile);

  // Mount global notifications bootstrap once.
  useNotificationsBootstrap();

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/settings') || location.pathname.startsWith('/studio');

  // Update sidebar mode when route or viewport changes
  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  // Calculate margins based on mode
  // RAIL: 72px left margin, HIDDEN: 0px left margin
  const mainMarginLeft = computedSidebarMode === 'RAIL' ? '72px' : '0px';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:from-[#0f0f0f] dark:via-[#0a0a0a] dark:to-[#000000] text-gray-900 dark:text-white">
        
      {/* Navbar */}
      <Navbar />

      {/* Sidebar */}
      {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen) && <Sidebar />}
       
      {/* Main Content Area */}
      <main
        className="pt-16 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out"
        style={{ marginLeft: mainMarginLeft }}
      >
        <div className="p-0 sm:p-2">
          {children || <Outlet />}
        </div>
      </main>

      {/* Backdrop for OVERLAY mode, Mobile Drawer, or Expanded Rail */}
      <GlassBackdrop
        isVisible={isSidebarOpen && !isRouteSidebarHidden}
        onClick={() => dispatch(closeSidebar())}
        variant="light"
        layer="overlay"
      />
    </div>
  );
};

