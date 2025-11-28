
import { Sidebar } from './SideBar';
import React from 'react';
import { Navbar } from './Navbar';
// import { Sidebar } from './Sidebar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';

export const Layout: React.FC = () => {

  // Default to collapsed for both visitors and signed-in users
  const [isCollapsed, setIsCollapsed] = React.useState(true);
   const user = useSelector((s: RootState) => s.user.profile);
   const location = useLocation();
   const navigate = useNavigate();

   // Root path ('/') should always render Market; no brand-specific redirect
   React.useEffect(() => {
     void user; void location; void navigate;
   }, [user, location.pathname, navigate]);

  // Mount global notifications bootstrap once.
  useNotificationsBootstrap();

  return (
  <div
    className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-black"
    style={{
      // Drive alignment for navbar/content relative to sidebar width on desktop
      // Collapsed: 64px rail; Expanded: 192px overlay (content still offset by rail)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: CSS custom prop
      ['--sidebar-width' as any]: isCollapsed ? '64px' : '192px',
    }}
  >
        
        {/* Sidebar */}
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}/>
       
        {/* Navbar */}
        <Navbar isCollapsed={isCollapsed} onToggleSidebar={() => setIsCollapsed((v) => !v)}/>
       
        {/* Main Content Area */}
      {/* Keep content offset to collapsed width only; expanded sidebar overlays */}
      <main
        className={`pt-0 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out lg:ml-[var(--sidebar-width)]`}
      >
        {/* <main className="pt-32 pb-20 lg:pb-8 lg:ml-[240px] min-h-screen transition-all duration-200"> */}
       
        
          <div className="p-0 sm:p-2">
            <Outlet />
          </div>
        </main>

        {/* Backdrop overlay when the sidebar is expanded (desktop only) */}
        {(!isCollapsed) && (
          <div
            className="hidden lg:block fixed inset-0 left-[192px] bg-black/40 backdrop-blur-[1px] z-40"
            onClick={() => setIsCollapsed(true)}
            aria-hidden
          />
        )}
      </div>
  );
};
