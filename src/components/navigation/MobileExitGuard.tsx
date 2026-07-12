import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';

// Docks render below lg (1024px) — same breakpoint gates the exit guard so
// phones AND tablets get it; desktop keeps plain browser back behavior.
const MOBILE_MAX_WIDTH = 1024;
const DOUBLE_BACK_WINDOW_MS = 2000;

/** Runway + Market are the app "home" surfaces for the double-back exit prompt. */
const isHomePath = (pathname: string) =>
  pathname === '/' || pathname === '/market' || pathname === '/marketplace';

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_WIDTH;

/** React Router (data router) stores its stack index in history.state.idx. */
const historyIndex = (): number | null => {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/**
 * Mobile back model (web browser + PWA-style shell):
 * 1. Open overlays consume Back first (`useOverlayBackClose`) — not this guard.
 * 2. In-app history unwinds normally while idx > 0.
 * 3. At the root of the stack (idx === 0):
 *    - if not on home → navigate to home
 *    - if on home → "Press back again to exit"; second back within 2s leaves
 */
export default function MobileExitGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const lastExitPromptAtRef = useRef(0);

  // Arm on session start: duplicate the first entry so a single back never
  // silently leaves the app. The idx===0 check makes this idempotent
  // (StrictMode double-mount safe).
  useEffect(() => {
    if (!isMobileViewport()) return;
    if (historyIndex() !== 0) return;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: location.state,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMobileViewport()) return;
    if (navigationType !== 'POP') return;
    if (historyIndex() !== 0) return;

    const path = location.pathname;
    const now = Date.now();

    // Root of the stack but not home: first Back lands on home (not exit).
    if (!isHomePath(path)) {
      lastExitPromptAtRef.current = 0;
      navigate('/', { replace: true });
      // Re-arm so the next back on home can show the exit prompt.
      window.setTimeout(() => {
        if (!isMobileViewport()) return;
        if (historyIndex() !== 0) return;
        navigate(`${window.location.pathname}${window.location.search}${window.location.hash}`, {
          replace: false,
        });
      }, 0);
      return;
    }

    // On home at root: double-back exit prompt.
    if (now - lastExitPromptAtRef.current < DOUBLE_BACK_WINDOW_MS) {
      window.history.back();
      return;
    }
    lastExitPromptAtRef.current = now;
    toast.info('Press back again to exit', { duration: DOUBLE_BACK_WINDOW_MS });
    // Re-arm so a later single back prompts again instead of exiting.
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: location.state,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigationType]);

  return null;
}
