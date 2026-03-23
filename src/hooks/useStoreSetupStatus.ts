import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { getStoreStatus } from '@/api/StoreApi';

/**
 * Lightweight hook that tells the caller whether the current BRAND user
 * has completed their store setup (i.e. the store is "open").
 *
 * For non-BRAND users it always returns `true` (no restrictions apply).
 * While the status is being fetched it returns `null` (unknown / loading).
 */

let cachedIsStoreOpen: boolean | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useStoreSetupStatus(): boolean | null {
  const user = useSelector((s: RootState) => s.user.profile);
  const isBrand = user?.type === 'BRAND';

  const [isStoreOpen, setIsStoreOpen] = useState<boolean | null>(() => {
    if (!isBrand) return true;
    if (cachedIsStoreOpen !== null && Date.now() - cacheTime < CACHE_TTL) return cachedIsStoreOpen;
    return null;
  });

  useEffect(() => {
    if (!isBrand) {
      setIsStoreOpen(true);
      return;
    }

    // Serve from cache if fresh
    if (cachedIsStoreOpen !== null && Date.now() - cacheTime < CACHE_TTL) {
      setIsStoreOpen(cachedIsStoreOpen);
      return;
    }

    let mounted = true;
    getStoreStatus()
      .then((status) => {
        cachedIsStoreOpen = status.isStoreOpen;
        cacheTime = Date.now();
        if (mounted) setIsStoreOpen(status.isStoreOpen);
      })
      .catch(() => {
        // On error, don't restrict — fail open so the user can still navigate
        if (mounted) setIsStoreOpen(true);
      });

    return () => { mounted = false; };
  }, [isBrand]);

  return isStoreOpen;
}
