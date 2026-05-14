import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  const markOptimisticActive = useCallback((item: IslandBottomNavItem) => {
    if (!item.disabled) {
      setOptimisticActiveKey(item.key);
    }
  }, []);

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
        <div className="flex h-full items-center gap-1 overflow-x-auto scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const visual = item.icon ?? item.emoji;
            const isSelected = Boolean(
              !item.disabled &&
              (optimisticActiveKey ? optimisticActiveKey === item.key : item.active),
            );

            return (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                onPointerDown={item.disabled ? undefined : () => markOptimisticActive(item)}
                onMouseDown={item.disabled ? undefined : () => markOptimisticActive(item)}
                onTouchStart={item.disabled ? undefined : () => markOptimisticActive(item)}
                onClick={item.disabled ? undefined : () => onSelect(item)}
                aria-current={isSelected ? 'page' : undefined}
                aria-label={item.label}
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
                  <span className="text-[17px] leading-none" aria-hidden="true">
                    {visual}
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
