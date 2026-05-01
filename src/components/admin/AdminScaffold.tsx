import React, { useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/SideBar';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';
import { useLocation, Outlet } from 'react-router-dom';
import { useNotificationsBootstrap } from '@/hooks/useNotifications';
import { ISLAND_BOTTOM_NAV_MOBILE_CLEARANCE_CLASS } from '@/components/navigation/IslandBottomNav';

const AdminScaffold: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();

  useNotificationsBootstrap();

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  return (
    <div className={`min-h-screen overflow-x-hidden threadly-shell-bg ${ISLAND_BOTTOM_NAV_MOBILE_CLEARANCE_CLASS} md:pb-0`}>
      <Navbar minimal={false} />
      <Sidebar overlayOnly />
      <AdminSidebar />

      <div className="min-h-screen min-w-0 overflow-x-hidden px-4 pb-10 pt-20 md:pl-[220px]">
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminScaffold;
