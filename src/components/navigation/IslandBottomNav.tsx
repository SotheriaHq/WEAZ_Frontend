import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useLocation } from 'react-router-dom';

import CountBadge from '@/components/navigation/CountBadge';

export type IslandBottomNavItem = {
  key: string;
  label: string;
  path: string;
  emoji?: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Unread count rendered as a dot-badge over the icon. 0 hides it. */
  badge?: number;
};

type IslandBottomNavProps = {
  items: IslandBottomNavItem[];
  onSelect: (item: IslandBottomNavItem) => void;
  ariaLabel?: string;
  maxWidthClassName?: string;
};

export const ISLAND_BOTTOM_NAV_MOBILE_CLEARANCE_CLASS =
  'pb-[calc(env(safe-area-inset-bottom)+6rem)]';

export const ISLAND_BOTTOM_NAV_CLEARANCE_CLASS =
  `${ISLAND_BOTTOM_NAV_MOBILE_CLEARANCE_CLASS} lg:pb-8`;

/**
 * Lets a full-screen view suppress the island for as long as it is mounted.
 *
 * An open message thread owns the bottom of the screen: the composer, the
 * attachment control and the quick replies all live there, and a floating pill
 * on top of them means every send is a near-miss. The native app already hides
 * its island on a thread; the web island had no way to be told.
 *
 * Reference-counted, because more than one view can legitimately ask at once
 * (a thread behind a media viewer) and the LAST one to unmount must be the one
 * that restores it — a plain boolean would let the first unmount bring the
 * island back underneath the view still covering the screen.
 */
type IslandSuppressionListener = (suppressed: boolean) => void;

let islandSuppressionCount = 0;
const islandSuppressionListeners = new Set<IslandSuppressionListener>();

const emitIslandSuppression = () => {
  const suppressed = islandSuppressionCount > 0;
  islandSuppressionListeners.forEach((listener) => listener(suppressed));
};

export const suppressIslandBottomNav = (): (() => void) => {
  islandSuppressionCount += 1;
  emitIslandSuppression();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    islandSuppressionCount = Math.max(0, islandSuppressionCount - 1);
    emitIslandSuppression();
  };
};

export const useIslandBottomNavSuppressed = (): boolean => {
  const [suppressed, setSuppressed] = useState(islandSuppressionCount > 0);
  useEffect(() => {
    const listener: IslandSuppressionListener = (next) => setSuppressed(next);
    islandSuppressionListeners.add(listener);
    setSuppressed(islandSuppressionCount > 0);
    return () => {
      islandSuppressionListeners.delete(listener);
    };
  }, []);
  return suppressed;
};

/** Mount-scoped helper: hides the island while `active` is true. */
export const useSuppressIslandBottomNav = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    return suppressIslandBottomNav();
  }, [active]);
};

/**
 * The island renders below `lg`. Above it, the rail takes over.
 *
 * Exported so a page that has to leave room for the island can ask the same
 * question the island itself answers, instead of guessing a breakpoint. Getting
 * this wrong is not cosmetic: reserving island space on a viewport that has no
 * island is dead space at the bottom of a full-height screen, and on a tablet
 * that dead space is what pushed the conversation up under the navbar.
 */
export const ISLAND_BOTTOM_NAV_BREAKPOINT_PX = 1024;

/** Height of the pill (h-14) plus its bottom offset and a little breathing room. */
export const ISLAND_BOTTOM_NAV_RESERVED_PX = 84;

/**
 * Declares that this view sizes itself to the viewport and scrolls internally.
 *
 * The app shell adds `min-h-screen` plus bottom clearance for the island to
 * every page, which is right for a document that scrolls and wrong for a screen
 * that must not. A messages view measures itself to fill exactly what is left
 * below the navbar; the shell's clearance was then added UNDER it, so the
 * document was always ~96px taller than the viewport. Scrolling that overflow
 * is what slid the conversation header up under the fixed navbar and left a
 * band of empty space at the bottom — on an iPad, where there is no island at
 * all, that space was reserved for a control that never renders.
 *
 * Reference-counted for the same reason the island suppression is: nested or
 * overlapping full-screen views must not have the first one to unmount hand the
 * padding back while another is still on screen.
 */
type ViewportLockListener = (locked: boolean) => void;

let viewportLockCount = 0;
const viewportLockListeners = new Set<ViewportLockListener>();

const emitViewportLock = () => {
  const locked = viewportLockCount > 0;
  viewportLockListeners.forEach((listener) => listener(locked));
};

export const lockShellViewport = (): (() => void) => {
  viewportLockCount += 1;
  emitViewportLock();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    viewportLockCount = Math.max(0, viewportLockCount - 1);
    emitViewportLock();
  };
};

export const useShellViewportLocked = (): boolean => {
  const [locked, setLocked] = useState(viewportLockCount > 0);
  useEffect(() => {
    const listener: ViewportLockListener = (next) => setLocked(next);
    viewportLockListeners.add(listener);
    setLocked(viewportLockCount > 0);
    return () => {
      viewportLockListeners.delete(listener);
    };
  }, []);
  return locked;
};

/** Mount-scoped helper: locks the shell to the viewport while `active`. */
export const useLockShellViewport = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    return lockShellViewport();
  }, [active]);
};

/**
 * Every chip is on screen, or it is in the More sheet. Nothing is half-visible.
 *
 * The strip used to be `overflow-x-auto` with `min-w-[64px]` chips, which meant
 * the dock silently became a scroller the moment the items stopped fitting: the
 * main dock's last item (Profile) and the Studio dock's last three sat past the
 * right edge with no affordance saying so. A nav you have to discover by
 * swiping is a nav whose last entry does not exist.
 *
 * So the row no longer scrolls. Chips divide the width evenly, and anything
 * that cannot get a fair share moves into a sheet behind one More chip — which
 * is a thing you can see, unlike content parked off-screen.
 */

/**
 * The narrowest a chip may get before it stops being readable.
 *
 * A 17px glyph over a 10px label needs roughly this much to render the label
 * as a word rather than two letters and an ellipsis. It is the ONLY number in
 * the fitting maths — how many chips the dock shows is measured, never
 * declared, because neither input is fixed: the item list is built at render
 * time (setup locks, role, unread state, `DESKTOP_ONLY_ITEM_KEYS`) and the
 * width is whatever the device and the `maxWidthClassName` cap agree on. A
 * hard-coded "show five" is wrong in both directions — it hides items that fit
 * on a 430px phone and squeezes five illegible chips onto a 320px one.
 */
const MIN_ITEM_WIDTH_PX = 58;

/** `gap-1` on the row, in px — part of the same fitting maths. */
const ITEM_GAP_PX = 4;

/**
 * The most chips the row will ever show, however much width there is.
 *
 * Width is not the only constraint, and on the wide end it stops being the
 * binding one. The Studio dock is nine sections and grows with the product; a
 * 560px strip can fit eight 64px chips, and eight chips is a wall of targets a
 * thumb cannot pick from at a glance — the reader ends up reading the dock
 * instead of using it. Past six, an extra chip costs more in scanning than the
 * tap it saves, so the surplus goes to the More sheet where the items get full
 * labels and full-width rows.
 *
 * So the fit is `min(what fits, this)`: measurement sets the ceiling on small
 * screens, this sets it on large ones, and the dock never grows into a menu bar.
 */
const MAX_ITEM_SLOTS = 6;

/**
 * How many chips a row of `rowWidth` can show, given `itemCount` to place.
 *
 * Pure and exported so the fit can be asserted at the widths that actually
 * matter (320, 360, 430, 560) without mounting anything and guessing at
 * `clientWidth` in jsdom, where every element measures 0.
 */
export const resolveIslandCapacity = (rowWidth: number, itemCount: number): number => {
  // Before the first measurement, assume everything fits (up to the slot cap).
  // The layout effect corrects it pre-paint, so this is never a visible state.
  if (rowWidth <= 0) return Math.min(itemCount, MAX_ITEM_SLOTS);
  const fits = Math.floor(
    (rowWidth + ITEM_GAP_PX) / (MIN_ITEM_WIDTH_PX + ITEM_GAP_PX),
  );
  return Math.max(1, Math.min(fits, MAX_ITEM_SLOTS));
};

/**
 * Split the dock into what is shown and what the More sheet holds.
 *
 * The selected item is PROMOTED into the visible row when it would otherwise
 * fall into the sheet. A dock whose highlight is hidden behind a menu tells the
 * reader nothing about where they are, which is the dock's whole job — so
 * Analytics or Finance, once open, takes the last visible slot and the item it
 * displaced moves into the sheet.
 */
export const splitIslandItems = (
  items: IslandBottomNavItem[],
  capacity: number,
  selectedKey: string | null,
): { visibleItems: IslandBottomNavItem[]; overflowItems: IslandBottomNavItem[] } => {
  if (items.length <= capacity) {
    return { visibleItems: items, overflowItems: [] };
  }

  // One of the slots the row can fit has to be the More chip itself.
  const visibleCount = Math.max(1, capacity - 1);
  const head = items.slice(0, visibleCount);
  const tail = items.slice(visibleCount);
  const selectedInTail = tail.findIndex((item) =>
    selectedKey ? item.key === selectedKey : item.active,
  );

  if (selectedInTail === -1) {
    return { visibleItems: head, overflowItems: tail };
  }

  const promoted = tail[selectedInTail];
  const demoted = head[head.length - 1];
  return {
    visibleItems: [...head.slice(0, -1), promoted],
    // The demoted item goes to the FRONT of the sheet, not into the hole the
    // promoted one left. Both lists then still read in the order the caller
    // declared, so an item never appears to jump its neighbours just because
    // something further down happens to be open.
    overflowItems: [
      demoted,
      ...tail.slice(0, selectedInTail),
      ...tail.slice(selectedInTail + 1),
    ],
  };
};

const ITEM_BASE_CLASS =
  'flex h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-semibold leading-none ' +
  // The browser's own tap highlight is the third indicator nobody asked for: a
  // translucent rectangle painted over a pill-shaped button, on top of the
  // press feedback and the active state this component already draws.
  '[-webkit-tap-highlight-color:transparent] touch-manipulation select-none ' +
  // A press reads as a press, not as a second background. The colour change is
  // already carried by the optimistic active state below.
  'transition-[background-color,color,box-shadow,transform] duration-150 motion-safe:active:scale-[0.94]';

/**
 * The one active treatment: frosted purple.
 *
 * Three overlays used to land on a pressed chip at once — the sticky `:hover`
 * grey (mobile browsers latch `:hover` on tap and never release it), the tap
 * highlight rectangle, and the selected background. `hover:` is now fenced
 * behind `(hover: hover)` so a finger can never trigger it, the highlight is
 * off, and this is what is left.
 */
const ITEM_SELECTED_CLASS =
  'bg-gradient-to-b from-purple-500/25 to-fuchsia-500/10 text-purple-700 ' +
  'shadow-[inset_0_0_0_1px_rgba(168,85,247,0.45),0_2px_12px_-2px_rgba(147,51,234,0.45)] backdrop-blur-sm ' +
  'dark:from-purple-400/30 dark:to-fuchsia-400/10 dark:text-purple-100 ' +
  'dark:shadow-[inset_0_0_0_1px_rgba(216,180,254,0.40),0_2px_14px_-2px_rgba(168,85,247,0.55)]';

const ITEM_IDLE_CLASS =
  'text-gray-600 dark:text-gray-300 ' +
  '[@media(hover:hover)]:hover:bg-gray-100/90 [@media(hover:hover)]:hover:text-gray-900 ' +
  'dark:[@media(hover:hover)]:hover:bg-white/10 dark:[@media(hover:hover)]:hover:text-white';

export const IslandBottomNav: React.FC<IslandBottomNavProps> = ({
  items,
  onSelect,
  ariaLabel = 'Primary navigation',
  maxWidthClassName = 'max-w-[420px]',
}) => {
  const location = useLocation();
  const islandSuppressed = useIslandBottomNavSuppressed();
  const [optimisticActiveKey, setOptimisticActiveKey] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const currentLocation = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  const itemMatchesLocation = useCallback(
    (item: IslandBottomNavItem) => {
      const [pathOnly, query = ''] = item.path.split('?');
      const target = query ? `${pathOnly}?${query}` : pathOnly;
      return query ? currentLocation === target : location.pathname === pathOnly;
    },
    [currentLocation, location.pathname],
  );

  useEffect(() => {
    if (!optimisticActiveKey) return;
    const pendingItem = items.find((item) => item.key === optimisticActiveKey);
    if (pendingItem && itemMatchesLocation(pendingItem)) {
      setOptimisticActiveKey(null);
    }
  }, [itemMatchesLocation, items, optimisticActiveKey]);

  /**
   * Press-time feedback that a scroll can take back.
   *
   * The optimistic highlight used to be applied on `pointerdown`/`touchstart`
   * and never withdrawn. The dock scrolls horizontally, so starting a swipe
   * necessarily puts a finger down on some item — that item lit up, the gesture
   * turned out to be a scroll, no `click` ever followed, and the highlight
   * stayed on a tab the user never chose. The indicator effectively tracked
   * wherever a finger had last rested.
   *
   * A press is now only a CANDIDATE. It lights up immediately (feedback still
   * arrives on touch, not on release) but is withdrawn the moment the gesture
   * proves to be a drag or a scroll. `click` only fires for a real tap, so the
   * committed state still comes from the route change as before.
   */
  const pendingPressRef = useRef<{ key: string; x: number; y: number } | null>(null);
  // Comfortably below the platform tap slop (~10px on both iOS and Android),
  // so a steady finger is never mistaken for a drag.
  const DRAG_SLOP_PX = 8;

  const cancelPendingPress = useCallback(() => {
    if (!pendingPressRef.current) return;
    const cancelledKey = pendingPressRef.current.key;
    pendingPressRef.current = null;
    setOptimisticActiveKey((current) => (current === cancelledKey ? null : current));
  }, []);

  const beginPress = useCallback(
    (item: IslandBottomNavItem, event: React.PointerEvent<HTMLButtonElement>) => {
      if (item.disabled) return;
      pendingPressRef.current = {
        key: item.key,
        x: event.clientX,
        y: event.clientY,
      };
      setOptimisticActiveKey(item.key);
    },
    [],
  );

  const trackPress = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pending = pendingPressRef.current;
      if (!pending) return;
      const movedFar =
        Math.abs(event.clientX - pending.x) > DRAG_SLOP_PX ||
        Math.abs(event.clientY - pending.y) > DRAG_SLOP_PX;
      if (movedFar) cancelPendingPress();
    },
    [cancelPendingPress],
  );

  /**
   * How many chips actually fit, measured from the rendered row.
   *
   * `useLayoutEffect` rather than `useEffect`: the measurement lands before the
   * browser paints, so the corrected row is the first thing drawn instead of a
   * frame of squeezed chips. A `ResizeObserver` keeps it true through rotation,
   * a resized window, and the `maxWidthClassName` cap changing between docks.
   */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [rowWidth, setRowWidth] = useState(0);

  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node) return;

    const measure = () => setRowWidth(node.clientWidth);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [islandSuppressed, items.length]);

  const capacity = useMemo(
    () => resolveIslandCapacity(rowWidth, items.length),
    [items.length, rowWidth],
  );

  const { visibleItems, overflowItems } = useMemo(
    () => splitIslandItems(items, capacity, optimisticActiveKey),
    [capacity, items, optimisticActiveKey],
  );

  const overflowHasSelection = overflowItems.some((item) =>
    optimisticActiveKey ? item.key === optimisticActiveKey : item.active,
  );
  const overflowBadgeTotal = overflowItems.reduce(
    (total, item) => total + (item.disabled ? 0 : (item.badge ?? 0)),
    0,
  );

  // Route changes are what close the sheet; a tab that is already open closes
  // it too, because the tap still means "I am done here".
  useEffect(() => {
    setMoreOpen(false);
  }, [currentLocation]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  if (items.length === 0) {
    return null;
  }

  // A full-screen view that owns the bottom of the screen (an open message
  // thread) has asked for the island to stand down.
  if (islandSuppressed) return null;

  const isItemSelected = (item: IslandBottomNavItem) =>
    Boolean(
      !item.disabled &&
        (optimisticActiveKey ? optimisticActiveKey === item.key : item.active),
    );

  const chooseItem = (item: IslandBottomNavItem) => {
    pendingPressRef.current = null;
    setMoreOpen(false);
    // Re-tapping the current tab must not stack another history entry
    // (mobile back-button pollution).
    if (itemMatchesLocation(item)) return;
    setOptimisticActiveKey(item.key);
    onSelect(item);
  };

  return (
    <>
      {/*
        The sheet's dismiss surface. It sits under the island but over the page,
        so the first tap anywhere outside closes the menu instead of activating
        whatever was beneath it.
      */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      ) : null}

      <nav
        aria-label={ariaLabel}
        className="fixed inset-x-0 z-50 flex flex-col items-center px-4 pointer-events-none bottom-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden"
      >
        {moreOpen && overflowItems.length > 0 ? (
          <div
            id="island-more-sheet"
            className={clsx(
              // `max-h` + scroll so a dock that grows past what the screen can
              // show above the pill stays reachable rather than running off the
              // top of the viewport.
              'pointer-events-auto mb-2 max-h-[55dvh] w-[calc(100vw-32px)] overflow-y-auto scrollbar-hide rounded-3xl border border-gray-200/70 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-2xl motion-safe:animate-slide-up-fade dark:border-white/10 dark:bg-black/85',
              maxWidthClassName,
            )}
          >
            {overflowItems.map((item) => {
              const visual = item.icon ?? item.emoji;
              const isSelected = isItemSelected(item);
              const showBadge = Boolean(!item.disabled && item.badge && item.badge > 0);

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onClick={item.disabled ? undefined : () => chooseItem(item)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold',
                    '[-webkit-tap-highlight-color:transparent] touch-manipulation',
                    'transition-[background-color,color,box-shadow,transform] duration-150 motion-safe:active:scale-[0.98]',
                    item.disabled
                      ? 'cursor-not-allowed text-gray-400 opacity-50 dark:text-gray-600'
                      : isSelected
                        ? ITEM_SELECTED_CLASS
                        : ITEM_IDLE_CLASS,
                  )}
                  title={item.disabled ? `${item.label} is locked` : item.label}
                >
                  {visual ? (
                    <span className="shrink-0 text-[17px] leading-none" aria-hidden="true">
                      {visual}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {showBadge ? (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-[18px] text-white">
                      {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className={clsx(
            'pointer-events-auto h-14 w-[calc(100vw-32px)] overflow-hidden rounded-full border border-gray-200/70 bg-white/90 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/75 dark:shadow-[0_12px_34px_rgba(0,0,0,0.48)]',
            maxWidthClassName,
          )}
        >
          <div
            ref={rowRef}
            onPointerMove={trackPress}
            onPointerCancel={cancelPendingPress}
            onPointerLeave={cancelPendingPress}
            className="flex h-full items-center gap-1"
          >
            {visibleItems.map((item) => {
              const visual = item.icon ?? item.emoji;
              const isSelected = isItemSelected(item);
              const showBadge = Boolean(!item.disabled && item.badge && item.badge > 0);

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  // Pointer events only: they cover mouse and touch, and the old
                  // trio (pointerdown + mousedown + touchstart) fired the same
                  // handler up to three times for one press.
                  onPointerDown={item.disabled ? undefined : (event) => beginPress(item, event)}
                  onClick={item.disabled ? undefined : () => chooseItem(item)}
                  aria-current={isSelected ? 'page' : undefined}
                  aria-label={
                    showBadge ? `${item.label}, ${item.badge} unread` : item.label
                  }
                  title={item.disabled ? `${item.label} is locked` : item.label}
                  className={clsx(
                    ITEM_BASE_CLASS,
                    item.disabled
                      ? 'cursor-not-allowed text-gray-400 opacity-50 dark:text-gray-600'
                      : isSelected
                        ? ITEM_SELECTED_CLASS
                        : ITEM_IDLE_CLASS,
                  )}
                >
                  {visual ? (
                    <span className="relative text-[17px] leading-none" aria-hidden="true">
                      {visual}
                      {showBadge && <CountBadge count={item.badge ?? 0} className="-right-2.5 -top-1.5" />}
                    </span>
                  ) : null}
                  <span className="max-w-full truncate leading-tight">{item.label}</span>
                </button>
              );
            })}

            {overflowItems.length > 0 ? (
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-controls="island-more-sheet"
                aria-label={`More sections, ${overflowItems.length} more`}
                title="More"
                className={clsx(
                  ITEM_BASE_CLASS,
                  moreOpen || overflowHasSelection ? ITEM_SELECTED_CLASS : ITEM_IDLE_CLASS,
                )}
              >
                <span className="relative text-[17px] leading-none" aria-hidden="true">
                  ⋯
                  {overflowBadgeTotal > 0 && (
                    <CountBadge count={overflowBadgeTotal} className="-right-2.5 -top-1.5" />
                  )}
                </span>
                <span className="max-w-full truncate leading-tight">More</span>
              </button>
            ) : null}
          </div>
        </div>
      </nav>
    </>
  );
};

export default IslandBottomNav;
