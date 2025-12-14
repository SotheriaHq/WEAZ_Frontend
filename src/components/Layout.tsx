import React, { useEffect } from 'react';
import { Sidebar } from './SideBar';
import { Navbar } from './Navbar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';
import { setSidebarMode, closeSidebar, toggleSidebar } from '@/features/uiSlice';
import GlassBackdrop from './ui/GlassBackdrop';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const user = useSelector((s: RootState) => s.user.profile);

  // Mount global notifications bootstrap once.
  useNotificationsBootstrap();

  // Determine mode based on route
  useEffect(() => {
    const isSettingsPage = location.pathname.startsWith('/settings');
    
    // Mobile check (simple width check for initial load)
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
       // Mobile always defaults to hidden/overlay logic handled by component
       // But for global state, we can set it to HIDDEN initially
       dispatch(setSidebarMode('HIDDEN'));
    } else {
      if (isSettingsPage) {
        dispatch(setSidebarMode('HIDDEN')); // Settings page has its own sidebar, global is hidden/overlay
      } else {
        // Default to RAIL for other pages on desktop
        // If it was DRAWER, we might want to keep it, but for now reset to RAIL on nav?
        // Let's keep it persistent if already set, otherwise default RAIL
        // Actually, YouTube defaults to RAIL on home usually, or persistent.
        // Let's default to RAIL for now.
        dispatch(setSidebarMode('RAIL'));
      }
    }
  }, [location.pathname, dispatch]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        dispatch(setSidebarMode('HIDDEN'));
      } else {
        if (location.pathname.startsWith('/settings')) {
          dispatch(setSidebarMode('HIDDEN'));
        } else {
          // If coming from mobile, default to RAIL
          dispatch(setSidebarMode('RAIL'));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch, location.pathname]);


  // Calculate margins and classes based on mode
  // RAIL: 64px left margin
  // HIDDEN: 0px left margin (Settings page)
  // OVERLAY/DRAWER: We now treat expanded state as Overlay, so margin doesn't change.
  
  let mainMarginLeft = '0px';
  if (sidebarMode === 'RAIL') mainMarginLeft = '72px'; // Updated to 72px to match Sidebar width
  // if (sidebarMode === 'DRAWER') mainMarginLeft = '240px'; // REMOVED: No push behavior
  // OVERLAY and HIDDEN have 0px margin (or 72px if Rail is behind it)
  
  // Actually, if we are in RAIL mode, the rail is always there.
  // If we open the sidebar, it becomes an overlay ON TOP of the rail.
  // So the content margin should stay at 72px (Rail width).
  // If we are in HIDDEN mode (Settings), margin is 0.
  
  if (sidebarMode === 'RAIL') {
      mainMarginLeft = '72px';
  } else if (sidebarMode === 'HIDDEN') {
      mainMarginLeft = '0px';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:from-[#0f0f0f] dark:via-[#0a0a0a] dark:to-[#000000] text-gray-900 dark:text-white">
        
      {/* Navbar */}
      <Navbar />

      {/* Sidebar */}
      <Sidebar />
       
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
        isVisible={Boolean(isSidebarOpen && (sidebarMode === 'OVERLAY' || sidebarMode === 'HIDDEN' || sidebarMode === 'RAIL' || window.innerWidth < 1024))}
        onClick={() => dispatch(closeSidebar())}
        variant="light"
        zIndex={40}
      />
    </div>
  );
};
