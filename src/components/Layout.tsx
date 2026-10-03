import React, { useEffect, useMemo } from 'react';
import { Sidebar } from './SideBar';
import { Navbar } from './Navbar';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { setSidebarMode, closeSidebar, selectIsMobile } from '@/features/uiSlice';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import {
  ISLAND_BOTTOM_NAV_CLEARANCE_CLASS,
  useShellViewportLocked,
} from '@/components/navigation/IslandBottomNav';
import { isRunwayStagePath } from '@/components/navigation/navbarChrome';

interface LayoutProps {
  children?: React.ReactNode;
}

/**
 * Compute the correct sidebar mode based on route and viewport
 * This is called synchronously to avoid render flashes
 */
const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  // Mobile always hides sidebar
  if (isMobile) return 'HIDDEN' as const;
  
  // Settings page has its own sidebar
  if (pathname.startsWith('/settings')) return 'HIDDEN' as const;
  
  // Studio pages hide the rail
  if (pathname.startsWith('/studio')) return 'HIDDEN' as const;
  
  // Default to RAIL for desktop
  return 'RAIL' as const;
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';
  
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const isMobile = useSelector(selectIsMobile);
  /*
    A page that owns the viewport gets no shell padding at all.

    `min-h-screen` + island clearance is right for a document you scroll and
    wrong for a screen that must not scroll. On the messages view the shell was
    adding ~96px of island clearance BELOW a pane already measured to fill the
    remaining viewport, so the document was permanently taller than the screen.
    Every drag scrolled that overflow: the conversation header slid under the
    fixed navbar and a band of empty space appeared at the bottom.

    On an iPad the clearance was reserved for an island that does not even
    render — the nav is `lg:hidden`, tablets are `lg` and up — which is why the
    same page pushed up with nothing at the bottom to show for it.
  */
  const viewportLocked = useShellViewportLocked();

  // Notifications bootstrap moved UP to `RootLayout` in App.tsx. It was never
  // actually global here: StudioScaffold composes Navbar/Sidebar directly and
  // never renders Layout, so /studio/* ran with no socket and no polling.

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/studio') || isEmbeddedMobile;

  /**
   * The navbar is never immersive.
   *
   * Mobile Runway used to float the bar transparently over the reels stage, so
   * the design a reader came to look at ran underneath the wordmark, the bell
   * and the avatar — a model's face behind the hamburger. Reported twice, and
   * the second time as "why are you destroying my app", which is the correct
   * reading: the top of a photograph is not spare canvas.
   *
   * The bar owns a band at the top of the screen now, and the stage starts
   * below it (`RUNWAY_CHROME_HEIGHT_PX`). Nothing overlaps anything.
   *
   * Kept as a named constant rather than deleting the `immersive` prop —
   * `Navbar` still supports the treatment, and a future full-bleed surface that
   * genuinely wants it can opt in. Nothing does today.
   */
  const isImmersiveNav = false;

  /**
   * The phone Runway renders no top bar at all — see
   * `RUNWAY_STAGE_CHROME_HEIGHT_PX` for why this is not a return to the
   * rejected immersive treatment. The bar is removed, not made transparent, so
   * nothing lands on the design; only the category chips float, exactly as
   * native does.
   */
  const hidesNavbarForRunwayStage = isMobile && isRunwayStagePath(location.pathname);

  // The 64px top padding exists solely to clear the fixed bar. With no bar
  // there is nothing to clear, and keeping it leaves an empty band exactly
  // where the bar used to be — the reclaimed height would go straight back.
  const navbarSpacingClass = hidesNavbarForRunwayStage ? 'pt-0' : 'pt-16';

  // Update sidebar mode when route or viewport changes
  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  // Calculate margins based on mode
  // RAIL: 72px left margin, HIDDEN: 0px left margin
  const mainMarginLeft = !isEmbeddedMobile && computedSidebarMode === 'RAIL' ? '72px' : '0px';

  return (
    <div className="min-h-screen wiez-shell-bg text-gray-900 dark:text-white">
        
      {/* Navbar */}
      {!isEmbeddedMobile && !hidesNavbarForRunwayStage ? (
        <Navbar immersive={isImmersiveNav} />
      ) : null}

      {/* Sidebar */}
      {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
       
      {/* Main Content Area */}
      <main
        className={`transition-[margin] duration-300 ease-out ${
          isEmbeddedMobile
            ? 'min-h-screen pb-4 pt-0'
            : viewportLocked
              ? navbarSpacingClass
              : `min-h-screen ${ISLAND_BOTTOM_NAV_CLEARANCE_CLASS} ${navbarSpacingClass}`
        }`}
        style={{ marginLeft: mainMarginLeft }}
      >
        {/* will-change removed from main — it was promoting the entire page to
            its own GPU layer permanently, holding significant memory even when
            not animating. The transition-[margin] is infrequent enough that
            the browser handles it fine without a persistent compositing layer. */}
        <div className="px-0 sm:px-2">
          {children || <Outlet />}
        </div>
      </main>

    </div>
  );
};

