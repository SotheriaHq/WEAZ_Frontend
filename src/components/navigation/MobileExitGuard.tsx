import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';

// Docks render below lg (1024px) — same breakpoint gates the exit guard so
// phones AND tablets get it; desktop keeps plain browser back behavior.
const MOBILE_MAX_WIDTH = 1024;
const DOUBLE_BACK_WINDOW_MS = 2000;

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_WIDTH;

/** React Router (data router) stores its stack index in history.state.idx. */
const historyIndex = (): number | null => {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/**
 * Industry-standard mobile back behavior: back/swipe unwinds in-app history;
 * when it reaches the session's first entry the user sees
 * "Press back again to exit" and a second back within 2s actually leaves.
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

    const now = Date.now();
    if (now - lastExitPromptAtRef.current < DOUBLE_BACK_WINDOW_MS) {
      // Second back inside the window: actually leave the app.
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
