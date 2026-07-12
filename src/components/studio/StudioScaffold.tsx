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

      <div
        className={
          isEmbeddedMobile
            ? 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-2 sm:px-4'
            : 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-20 sm:px-4 lg:pb-10'
        }
      >
        <div className="mx-auto max-w-6xl min-w-0">
          {isEmbeddedMobile ? (
            <div className="embedded-studio-surface">
              <StudioEmbeddedSearchBridge />
              {children}
            </div>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <BrandSwitcher />
              </div>
              <div className="flex gap-6 items-start">
                <div className="hidden lg:block w-[180px] shrink-0 sticky top-20 h-[calc(100vh-100px)] overflow-y-auto scrollbar-hide">
                  <StudioSidebar active={active} onSelect={onSelect} />
                </div>
                <div className="flex-1 min-w-0">
                  {children}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioScaffold;
