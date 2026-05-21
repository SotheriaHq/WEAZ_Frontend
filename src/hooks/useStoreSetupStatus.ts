import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import { useStoreStatusQuery } from '@/query/queries';

/**
 * Lightweight hook that tells the caller whether the current BRAND user
 * has completed their store setup (i.e. the store is "open").
 *
 * For non-BRAND users it always returns `true` (no restrictions apply).
 * While the status is being fetched it returns `null` (unknown / loading).
 */

let cachedIsStoreOpen: boolean | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function invalidateStoreSetupStatusCache(): void {
  cachedIsStoreOpen = null;
  cacheTime = 0;
}

export function primeStoreSetupStatusCache(isStoreOpen: boolean): void {
  cachedIsStoreOpen = isStoreOpen;
  cacheTime = Date.now();
}

export function useStoreSetupStatus(): boolean | null {
  const user = useSelector((s: RootState) => s.user.profile);
  const isBrand = hasActiveBrandMembership(user);
  const statusQuery = useStoreStatusQuery({ enabled: isBrand });

  if (!isBrand) return true;
  if (statusQuery.data) {
    cachedIsStoreOpen = statusQuery.data.isStoreOpen;
    cacheTime = Date.now();
    return statusQuery.data.isStoreOpen;
  }
  if (cachedIsStoreOpen !== null && Date.now() - cacheTime < CACHE_TTL) {
    return cachedIsStoreOpen;
  }
  if (statusQuery.error) {
    return true;
  }
  return null;
}
