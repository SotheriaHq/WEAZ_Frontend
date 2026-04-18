import React, { useEffect } from 'react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/SideBar';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';

type StudioScaffoldProps = {
  active: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
};

const StudioScaffold: React.FC<StudioScaffoldProps> = ({ active, onSelect, children }) => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch]);

  return (
    <div className="min-h-screen threadly-shell-bg overflow-x-clip">
      <Navbar minimal={false} />
      <Sidebar overlayOnly />
      <StudioSidebar active={active} onSelect={onSelect} />

      <div className="min-h-screen px-3 pb-28 pt-20 sm:px-4 xl:pb-10 xl:pl-[236px]">
        <div className="mx-auto max-w-6xl min-w-0">{children}</div>
      </div>
    </div>
  );
};

export default StudioScaffold;
