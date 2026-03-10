import React, { useEffect } from 'react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/SideBar';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';
import { useLocation } from 'react-router-dom';

type StudioScaffoldProps = {
  active: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
};

const StudioScaffold: React.FC<StudioScaffoldProps> = ({ active, onSelect, children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  useEffect(() => {
    return () => {
      dispatch(closeSidebar());
    };
  }, [dispatch]);

  return (
    <div className="min-h-screen threadly-shell-bg">
      <Navbar minimal={false} />
      <Sidebar overlayOnly />
      <StudioSidebar active={active} onSelect={onSelect} />

      <div className="min-h-screen pb-10 px-4 md:pl-[220px] pt-20">
        <div className="max-w-6xl mx-auto">{children}</div>
      </div>
    </div>
  );
};

export default StudioScaffold;
