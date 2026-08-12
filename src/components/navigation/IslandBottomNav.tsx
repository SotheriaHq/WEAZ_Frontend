import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useLocation } from 'react-router-dom';

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

const ITEM_BASE_CLASS =
  'flex h-11 min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-semibold leading-none transition-colors';

export const IslandBottomNav: React.FC<IslandBottomNavProps> = ({
  items,
  onSelect,
  ariaLabel = 'Primary navigation',
  maxWidthClassName = 'max-w-[420px]',
}) => {
  const location = useLocation();
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
                    {showBadge && (
                      <span className="absolute -right-2.5 -top-1.5 min-w-[15px] rounded-full bg-fuchsia-600 px-1 text-[9px] font-bold leading-[15px] text-white shadow">
                        {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                      </span>
                    )}
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
