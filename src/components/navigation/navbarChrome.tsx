/**
 * Two channels from a full-bleed page up to the floating navbar.
 *
 * The Runway's mobile reels stage is a `fixed inset-0` scroller that owns the
 * whole viewport, with the navbar floating transparently over it. That layout
 * creates two problems the page cannot solve on its own, because the navbar is
 * rendered by `Layout`, not by the page:
 *
 * 1. **The category chips had nowhere to go.** They were drawn as a second row
 *    pinned below the bar (`absolute top-0 pt-16`), left-aligned and
 *    horizontally scrollable — so on a phone they ran off the right edge with
 *    the last chip cut in half, and they read as a stray strip pasted under the
 *    bar rather than as part of it. The navbar already has an empty middle
 *    region on mobile (the desktop search bar is `sm:flex`), which is exactly
 *    where a row of filters belongs: between the mark on the left and the
 *    controls on the right.
 *
 * 2. **The bar could not get out of the way.** The stage scrolls inside its own
 *    element, so `window.scrollY` never moves and the navbar's own scroll
 *    listener never fires. It sat at full strength over every design in the
 *    feed. Only the feed knows when it is being scrolled, so the feed has to say
 *    so.
 *
 * Both are module-level subscribable stores rather than context because the
 * producer (a page, deep in the route tree) and the consumer (the navbar, above
 * it in `Layout`) have no common provider that is not the app root — and adding
 * one would re-render the entire tree on every scroll frame. This mirrors the
 * reference-counted `lockShellViewport` in `IslandBottomNav.tsx`, which exists
 * for the same shape of problem.
 */
import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ *
 * Centre slot
 * ------------------------------------------------------------------ */

type SlotListener = () => void;

let slotElement: HTMLElement | null = null;
const slotListeners = new Set<SlotListener>();

function emitSlotChange() {
  slotListeners.forEach((listener) => listener());
}

function subscribeSlot(listener: SlotListener) {
  slotListeners.add(listener);
  return () => {
    slotListeners.delete(listener);
  };
}

function getSlotElement() {
  return slotElement;
}

/**
 * Rendered by the navbar. Claims the middle region on mobile.
 *
 * Hidden at `sm` and up, where the region belongs to the search bar — the chips
 * are a phone-layout answer and the desktop Runway renders masonry with its own
 * inline filter row.
 */
export const NavbarCenterSlotTarget: React.FC = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    slotElement = ref.current;
    emitSlotChange();
    return () => {
      slotElement = null;
      emitSlotChange();
    };
  }, []);

  return <div ref={ref} className="flex min-w-0 flex-1 justify-center px-1 sm:hidden" />;
};

/**
 * Rendered by a page. Portals its children into the navbar's middle region.
 *
 * Renders nothing until the target exists, which is the normal case on the
 * first paint after a route change — the effect that registers it runs after
 * this component's own first render.
 */
export const NavbarCenterSlot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const target = useSyncExternalStore(subscribeSlot, getSlotElement, getSlotElement);
  if (!target) return null;
  return createPortal(children, target);
};

/* ------------------------------------------------------------------ *
 * Auto-hide
 * ------------------------------------------------------------------ */

let navHidden = false;
const hideListeners = new Set<SlotListener>();

function subscribeHidden(listener: SlotListener) {
  hideListeners.add(listener);
  return () => {
    hideListeners.delete(listener);
  };
}

function getHidden() {
  return navHidden;
}

export function setImmersiveNavHidden(hidden: boolean) {
  if (navHidden === hidden) return;
  navHidden = hidden;
  hideListeners.forEach((listener) => listener());
}

export function useImmersiveNavHidden() {
  return useSyncExternalStore(subscribeHidden, getHidden, getHidden);
}

/**
 * Drives the bar from a scroller's own scroll events.
 *
 * The rule is the one every full-screen media feed uses: **movement hides the
 * chrome, stillness brings it back.** A feed is scrolled to look at the next
 * design, and a bar over the top of it during that is exactly what the report
 * called horrible. Coming back on settle rather than only on an upward scroll
 * matters because a vertical paging feed has no meaningful "scrolled up" — every
 * gesture lands on a new full-screen page.
 *
 * `SETTLE_MS` is long enough not to flicker between two flicks of a fast scroll
 * and short enough that the chips are back before someone reaches for them.
 */
const SETTLE_MS = 450;

export function useAutoHideNavOnScroll(enabled: boolean) {
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setImmersiveNavHidden(false);
      return;
    }
    return () => {
      // Leaving the feed must always give the bar back — a page that unmounts
      // mid-scroll would otherwise strand every later route without a navbar.
      setImmersiveNavHidden(false);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [enabled]);

  return useCallback(() => {
    if (!enabled) return;
    setImmersiveNavHidden(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setImmersiveNavHidden(false), SETTLE_MS);
  }, [enabled]);
}

/** Lets a tap-to-reveal surface bring the bar back immediately. */
export function revealImmersiveNav() {
  setImmersiveNavHidden(false);
}
