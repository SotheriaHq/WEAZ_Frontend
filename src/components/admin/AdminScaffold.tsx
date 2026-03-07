import React, { useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/SideBar';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';
import { useLocation, Outlet } from 'react-router-dom';

const AdminScaffold: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7] dark:bg-gray-950 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
      <Navbar minimal={false} />
      <Sidebar overlayOnly />
      <AdminSidebar />

      <div className="min-h-screen pb-10 px-4 md:pl-[220px] pt-20">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminScaffold;
