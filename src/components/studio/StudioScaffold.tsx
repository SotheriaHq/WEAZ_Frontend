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
import BrandSwitcher from '@/components/brand/BrandSwitcher';

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
    <div className="studio-shell min-h-dvh overflow-x-clip bg-[color:var(--surface-primary)] text-[color:var(--text-primary)]">
      {!isEmbeddedMobile ? <Navbar minimal={false} profileMenuContext="studio" /> : null}
      {!isEmbeddedMobile ? <Sidebar overlayOnly /> : null}
      <StudioSidebar active={active} onSelect={onSelect} />

      <div
        className={
          isEmbeddedMobile
            ? 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-2 sm:px-4'
            : 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-20 sm:px-4 lg:pb-10 lg:pl-[236px]'
        }
      >
        <div className={isEmbeddedMobile ? 'mx-auto max-w-6xl min-w-0 embedded-studio-surface' : 'mx-auto max-w-6xl min-w-0'}>
          {isEmbeddedMobile ? <StudioEmbeddedSearchBridge /> : null}
          {!isEmbeddedMobile ? (
            <div className="mb-3 flex justify-end">
              <BrandSwitcher />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
};

export default StudioScaffold;
