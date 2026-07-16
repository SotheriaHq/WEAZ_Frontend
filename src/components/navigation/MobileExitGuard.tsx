import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { overlayBackChannel } from '@/hooks/useOverlayBackClose';

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
 * Programmatic pops (in-app back buttons calling navigate(-1), overlay
 * cleanup calling history.back()) must keep their normal behavior — only a
 * real USER gesture/hardware back is remodeled. A user gesture never calls
 * these JS functions, so wrapping them cleanly separates the two. Counter
 * (not boolean) so bursts of programmatic pops each match one popstate.
 */
let pendingProgrammaticPops = 0;
let historyWrapped = false;
// Native (unwrapped) go — the guard's own exit jump must NOT count as a
// programmatic pop (if the browser can't actually leave, no popstate fires
// and the counter would go stale).
let nativeHistoryGo: ((delta?: number) => void) | null = null;

const wrapHistoryOnce = () => {
  if (historyWrapped || typeof window === 'undefined') return;
  historyWrapped = true;
  const nativeGo = window.history.go.bind(window.history);
  const nativeBack = window.history.back.bind(window.history);
  const nativeForward = window.history.forward.bind(window.history);
  nativeHistoryGo = nativeGo;
  window.history.go = (delta?: number) => {
    if (typeof delta === 'number' && delta !== 0) pendingProgrammaticPops += 1;
    nativeGo(delta);
  };
  window.history.back = () => {
    pendingProgrammaticPops += 1;
    nativeBack();
  };
  window.history.forward = () => {
    pendingProgrammaticPops += 1;
    nativeForward();
  };
};

/**
 * Mobile back model (web browser + PWA-style shell):
 * 1. Open overlays consume Back first (`useOverlayBackClose`) — not this guard.
 * 2. A user gesture Back from ANY page goes straight HOME — it never replays
 *    the visit trail page by page.
 * 3. A user gesture Back while ON home shows "Press back again to exit";
 *    a second Back within 2s jumps past the app's first history entry and
 *    actually leaves.
 * 4. Programmatic backs (in-app back buttons / navigate(-1)) keep their
 *    normal one-step behavior.
 */
export default function MobileExitGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const lastExitPromptAtRef = useRef(0);
  // Where the user IS before a pop lands somewhere else. Refs update after
  // each commit, so at popstate time they still describe the pre-pop page.
  const wasHomeRef = useRef(
    typeof window !== 'undefined' ? isHomePath(window.location.pathname) : true,
  );
  const lastIdxRef = useRef<number | null>(
    typeof window !== 'undefined' ? historyIndex() : null,
  );

  useEffect(() => {
    wasHomeRef.current = isHomePath(location.pathname);
    lastIdxRef.current = historyIndex();
  }, [location]);

  // Arm on session start: duplicate the first entry so a single back never
  // silently leaves the app before the exit prompt can show. The idx===0
  // check makes this idempotent (StrictMode double-mount safe).
  useEffect(() => {
    if (!isMobileViewport()) return;
    if (historyIndex() !== 0) return;
    navigateRef.current(
      `${location.pathname}${location.search}${location.hash}`,
      { state: location.state },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wrapHistoryOnce();

    const onPop = () => {
      // Programmatic pop (navigate(-1) back buttons, overlay cleanup): keep
      // standard behavior everywhere.
      if (pendingProgrammaticPops > 0) {
        pendingProgrammaticPops -= 1;
        return;
      }
      if (!isMobileViewport()) return;
      // An open overlay owns this Back — it closes itself in place.
      if (overlayBackChannel.consumesPop()) return;

      const landedIdx = historyIndex();
      const prevIdx = lastIdxRef.current;
      // Forward navigation: leave it alone.
      if (landedIdx !== null && prevIdx !== null && landedIdx > prevIdx) return;

      if (!wasHomeRef.current) {
        // Gesture Back from any non-home page: land HOME in one step. This
        // replaces the trail entry the pop landed on, so the browsing trail
        // is never replayed page by page.
        navigateRef.current('/', { replace: true });
        return;
      }

      // Gesture Back while on home → double-back exit.
      const now = Date.now();
      if (now - lastExitPromptAtRef.current < DOUBLE_BACK_WINDOW_MS) {
        const idx = historyIndex();
        const jump = typeof idx === 'number' && idx > 0 ? -(idx + 1) : -1;
        // Jump past the app's first entry in one hop — actually leaves.
        (nativeHistoryGo ?? window.history.go.bind(window.history))(jump);
        return;
      }
      lastExitPromptAtRef.current = now;
      toast.info('Press back again to exit', { duration: DOUBLE_BACK_WINDOW_MS });
      // Stay visually on home: replace whatever trail entry the pop landed on.
      navigateRef.current('/', { replace: true });
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return null;
}
