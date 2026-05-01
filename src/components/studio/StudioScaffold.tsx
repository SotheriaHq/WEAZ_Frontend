import React, { useEffect } from 'react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import StudioEmbeddedSearchBridge from '@/components/studio/StudioEmbeddedSearchBridge';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/SideBar';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

type StudioScaffoldProps = {
  active: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
};

const StudioScaffold: React.FC<StudioScaffoldProps> = ({ active, onSelect, children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch]);

  useEffect(() => {
    if (!isEmbeddedMobile) return;
    postStudioNativeEvent({ type: 'READY' });
  }, [isEmbeddedMobile]);

  return (
    <div className="min-h-screen threadly-shell-bg overflow-x-clip">
      {!isEmbeddedMobile ? <Navbar minimal={false} /> : null}
      {!isEmbeddedMobile ? <Sidebar overlayOnly /> : null}
      <StudioSidebar active={active} onSelect={onSelect} />

      <div
        className={
          isEmbeddedMobile
            ? 'min-h-screen px-3 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-3 sm:px-4'
            : 'min-h-screen px-3 pb-28 pt-20 sm:px-4 md:pb-10 md:pl-[236px]'
        }
      >
        <div className={isEmbeddedMobile ? 'mx-auto max-w-6xl min-w-0 embedded-studio-surface' : 'mx-auto max-w-6xl min-w-0'}>
          {isEmbeddedMobile ? <StudioEmbeddedSearchBridge /> : null}
          {children}
        </div>
      </div>
    </div>
  );
};

export default StudioScaffold;
