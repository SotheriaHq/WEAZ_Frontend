import { useEffect, useState, useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** Whether the browser is online, from the same signal React Query pauses on. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export const MARKET_STALE_AFTER_MS = 3 * 60 * 1000;

/**
 * True when the shopper comes back to the tab (or the page mounts) with data
 * older than three minutes. Market does not refetch on its own then; it offers
 * a "Refresh" instead, so nothing moves under the shopper's thumb.
 */
export function useStaleOnReturn(dataUpdatedAt: number): boolean {
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setCheckedAt(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  return dataUpdatedAt > 0 && checkedAt - dataUpdatedAt > MARKET_STALE_AFTER_MS;
}
