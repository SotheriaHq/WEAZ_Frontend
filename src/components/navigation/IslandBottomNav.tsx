import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const ITEM_BASE_CLASS =
  'flex h-11 min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-semibold leading-none transition-colors';

export const IslandBottomNav: React.FC<IslandBottomNavProps> = ({
  items,
  onSelect,
  ariaLabel = 'Primary navigation',
  maxWidthClassName = 'max-w-[420px]',
}) => {
  const location = useLocation();
  const islandSuppressed = useIslandBottomNavSuppressed();
  const [optimisticActiveKey, setOptimisticActiveKey] = useState<string | null>(null);
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

  if (items.length === 0) {
    return null;
  }

  // A full-screen view that owns the bottom of the screen (an open message
  // thread) has asked for the island to stand down.
  if (islandSuppressed) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none bottom-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden"
    >
      <div
        className={clsx(
          'pointer-events-auto h-14 w-[calc(100vw-32px)] overflow-hidden rounded-full border border-gray-200/70 bg-white/90 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/75 dark:shadow-[0_12px_34px_rgba(0,0,0,0.48)]',
          maxWidthClassName,
        )}
      >
        <div
          // A scroll is the definitive proof the press was not a tap — the
          // strip cannot scroll unless the finger dragged it.
          onScroll={cancelPendingPress}
          onPointerMove={trackPress}
          onPointerCancel={cancelPendingPress}
          onPointerLeave={cancelPendingPress}
          className="flex h-full items-center gap-1 overflow-x-auto scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const visual = item.icon ?? item.emoji;
            const isSelected = Boolean(
              !item.disabled &&
              (optimisticActiveKey ? optimisticActiveKey === item.key : item.active),
            );
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
                onClick={
                  item.disabled
                    ? undefined
                    : () => {
                        pendingPressRef.current = null;
                        // Re-tapping the current tab must not stack another
                        // history entry (mobile back-button pollution).
                        if (itemMatchesLocation(item)) return;
                        setOptimisticActiveKey(item.key);
                        onSelect(item);
                      }
                }
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
                      ? 'bg-purple-50 text-purple-700 shadow-[inset_0_0_0_1px_rgba(147,51,234,0.12)] dark:bg-purple-500/20 dark:text-purple-200'
                      : 'text-gray-600 hover:bg-gray-100/90 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
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
        </div>
      </div>
    </nav>
  );
};

export default IslandBottomNav;
