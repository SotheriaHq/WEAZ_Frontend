/**
 * Auto-hide for the floating navbar over a full-bleed page.
 *
 * The Runway's mobile reels stage is a `fixed inset-0` scroller that owns the
 * whole viewport, with the navbar floating transparently over it. Two
 * consequences, and both need a channel from the page up to `Layout`'s navbar:
 *
 * - **The bar could not observe the feed.** The stage scrolls inside its own
 *   element, so `window.scrollY` never moves and the navbar's own scroll
 *   listener never fires. It sat at full strength over every design in the feed.
 * - **The page has to know when the bar is gone**, because the category chips
 *   move into the space it vacates.
 *
 * A module-level subscribable store rather than context: the producer (a page,
 * deep in the route tree) and the consumer (the navbar, above it in `Layout`)
 * share no provider that is not the app root, and adding one would re-render the
 * entire tree on every scroll frame. Same shape of problem as the
 * reference-counted `lockShellViewport` in `IslandBottomNav.tsx`.
 *
 * ## What this deliberately does NOT do
 *
 * There is no tap-to-reveal. A stage whose chrome appears and disappears on
 * press competes with the feed's own tap gesture (which reveals the design's
 * meta), so a single tap has to mean two things and the second press means
 * neither reliably. Scroll state is the only input.
 *
 * And the chips are **not** rendered inside the navbar. They were, and hiding
 * the bar took the filters with it — the one control on the surface that has to
 * stay reachable while browsing. They are the page's own row now; this module
 * only tells it how much room it has.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** Height of the bar (`h-16`), in px. The chips sit under it. */
export const IMMERSIVE_NAV_HEIGHT_PX = 64;

/** Height of the Runway category-chip row that sits directly under the bar. */
export const RUNWAY_CHIPS_HEIGHT_PX = 44;

/**
 * Everything above the Runway stage: the bar plus the chip row.
 *
 * The reels stage starts here rather than at 0. The bar used to float over the
 * media — full-bleed looked right in the abstract and meant, in practice, that
 * a model's face sat behind the hamburger and the wordmark. Chrome gets its own
 * band; the photograph gets the rest.
 */
export const RUNWAY_CHROME_HEIGHT_PX =
  IMMERSIVE_NAV_HEIGHT_PX + RUNWAY_CHIPS_HEIGHT_PX;

/**
 * The Runway stage on a phone browser: no top bar at all.
 *
 * There have been three shapes here and it is worth knowing why this is the
 * third. A transparent bar floating over the media was rejected twice, and
 * correctly — the wordmark, the bell and the avatar sat on a model's face.
 * Giving the bar its own solid band fixed the overlap and cost 108px of a
 * ~640px viewport, which is the screen "looking short": a sixth of a
 * full-bleed photograph spent on chrome the reader is not using while
 * browsing.
 *
 * The native app resolves this by not having a top bar on the Runway at all,
 * and that is what the phone browser does now. The critical difference from
 * the rejected version is WHAT overlaps: the wordmark, hamburger, search, bell
 * and avatar are gone rather than made transparent. Only the category chips
 * remain over the media — one thin row, the same control native floats, on the
 * same gradient scrim.
 *
 * The trade-off is real and deliberate: search and notifications are not
 * reachable from this one route on a phone browser. Every other route keeps
 * the full bar, and the floating island still reaches Market, Subs, Messages
 * and Profile.
 */
export const RUNWAY_STAGE_CHROME_HEIGHT_PX = RUNWAY_CHIPS_HEIGHT_PX;

/**
 * Routes that render the full-bleed Runway stage.
 *
 * Shared so `Layout` (which decides whether to render the bar) and `Runway`
 * (which positions the stage under it) cannot disagree. If they do, the result
 * is either a floating bar over the media or a black band where the bar used
 * to be.
 */
export function isRunwayStagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/runway';
}

type Listener = () => void;

let navHidden = false;
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getHidden() {
  return navHidden;
}

export function setImmersiveNavHidden(hidden: boolean) {
  if (navHidden === hidden) return;
  navHidden = hidden;
  listeners.forEach((listener) => listener());
}

export function useImmersiveNavHidden() {
  return useSyncExternalStore(subscribe, getHidden, getHidden);
}

/**
 * How long the feed must be still before the bar comes back.
 *
 * A second, and the length is the point. Shorter and the bar flickers back
 * between two flicks of a fast scroll — which is what "not smooth" describes.
 * The bar returning is a signal that the reader has ARRIVED somewhere, so it
 * should wait until they have.
 */
const SETTLE_MS = 1000;

export type ImmersiveScrollHandlers = {
  onScroll: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
};

/**
 * Drives the bar from a scroller's own events.
 *
 * **Movement hides the chrome; stillness with the finger lifted brings it back.**
 * Both halves of that condition matter. Scroll events stop firing the moment a
 * finger stops moving even though it is still down and about to fling again, so
 * settling on time alone brings the bar back under a resting thumb mid-gesture.
 * The reveal therefore waits for `touchend` as well, and a touch that starts
 * while the timer is running cancels it.
 *
 * Returns handlers to spread onto the scrolling element rather than attaching
 * its own listeners, so there is exactly one subscription and the page decides
 * which element is the feed.
 */
export function useAutoHideNavOnScroll(enabled: boolean): ImmersiveScrollHandlers {
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchingRef = useRef(false);
  const scrollIdleRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  const armReveal = useCallback(() => {
    clearTimer();
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      scrollIdleRef.current = true;
      // A finger still on the glass means the gesture is not over, however long
      // it has been since the last scroll event. `onTouchEnd` re-arms.
      if (!touchingRef.current) setImmersiveNavHidden(false);
    }, SETTLE_MS);
  }, [clearTimer]);

  useEffect(() => {
    if (!enabled) {
      setImmersiveNavHidden(false);
      return undefined;
    }
    return () => {
      // Leaving the feed must always give the bar back — a page unmounted
      // mid-scroll would otherwise strand every later route without a navbar.
      setImmersiveNavHidden(false);
      clearTimer();
    };
  }, [clearTimer, enabled]);

  const onScroll = useCallback(() => {
    if (!enabled) return;
    scrollIdleRef.current = false;
    setImmersiveNavHidden(true);
    armReveal();
  }, [armReveal, enabled]);

  const onTouchStart = useCallback(() => {
    if (!enabled) return;
    touchingRef.current = true;
    // A touch that lands while the bar is on its way back cancels the reveal:
    // the reader is reaching for the next design, not settling on this one.
    clearTimer();
  }, [clearTimer, enabled]);

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;
    touchingRef.current = false;
    if (scrollIdleRef.current) {
      // The finger never moved the feed — nothing was hidden, nothing to restore.
      setImmersiveNavHidden(false);
      return;
    }
    armReveal();
  }, [armReveal, enabled]);

  return { onScroll, onTouchStart, onTouchEnd };
}
