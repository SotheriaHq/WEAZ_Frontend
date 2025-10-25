
import { Sidebar } from './SideBar';
import React from 'react';
import { Navbar } from './Navbar';
// import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {

   const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
  <div className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-black">
        
        {/* Sidebar */}
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}/>
       
        {/* Navbar */}
        <Navbar isCollapsed={isCollapsed}/>
       
        {/* Main Content Area */}
      <main
        className={`pt-20 pb-20 lg:pb-8 min-h-screen transition-[margin] duration-300 will-change-[margin] ease-out ${isCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[192px]'}`}
      >
        {/* <main className="pt-32 pb-20 lg:pb-8 lg:ml-[240px] min-h-screen transition-all duration-200"> */}
       
        
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
  );
};
