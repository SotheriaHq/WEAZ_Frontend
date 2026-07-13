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
    <div className="studio-shell min-h-dvh bg-[color:var(--surface-primary)] text-[color:var(--text-primary)]">
      {!isEmbeddedMobile ? <Navbar minimal={false} profileMenuContext="studio" /> : null}
      {!isEmbeddedMobile ? <Sidebar overlayOnly /> : null}
      {/* Fixed studio sidebar (desktop) — stays put and never grows with the
          page; the mobile island dock lives inside it and self-shows on < lg. */}
      {!isEmbeddedMobile ? <StudioSidebar active={active} onSelect={onSelect} /> : null}

      <div
        className={
          isEmbeddedMobile
            ? 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-2 sm:px-4'
            : 'min-h-dvh bg-[color:var(--surface-primary)] px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-20 sm:px-4 lg:pb-10 lg:pl-[236px]'
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
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioScaffold;
