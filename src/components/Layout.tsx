
import { Sidebar } from './SideBar';
import React from 'react';
import { Navbar } from './Navbar';
// import { Sidebar } from './Sidebar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';

export const Layout: React.FC = () => {

   const [isCollapsed, setIsCollapsed] = React.useState(false);
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
  <div className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-black">
        
        {/* Sidebar */}
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}/>
       
        {/* Navbar */}
        <Navbar isCollapsed={isCollapsed}/>
       
        {/* Main Content Area */}
      <main
        className={`pt-2 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out ${isCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[192px]'}`}
      >
        {/* <main className="pt-32 pb-20 lg:pb-8 lg:ml-[240px] min-h-screen transition-all duration-200"> */}
       
        
          <div className="p-2 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
  );
};
