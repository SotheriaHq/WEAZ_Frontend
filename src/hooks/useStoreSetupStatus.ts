import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import { useStoreStatusQuery } from '@/query/queries';

/**
 * Tells the caller whether the current brand user has COMPLETED the store
 * setup flow (`isSetupComplete`). This is independent of whether the store is
 * currently open/paused (`isStoreOpen`) — a completed store that is paused is
 * still "set up".
 *
 * For non-brand users it always returns `true` (no restrictions apply).
 * While the status is being fetched it returns `null` (unknown / loading).
 */

let cachedSetupComplete: boolean | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function invalidateStoreSetupStatusCache(): void {
  cachedSetupComplete = null;
  cacheTime = 0;
}

export function primeStoreSetupStatusCache(isSetupComplete: boolean): void {
  cachedSetupComplete = isSetupComplete;
  cacheTime = Date.now();
}

export function useStoreSetupStatus(): boolean | null {
  const user = useSelector((s: RootState) => s.user.profile);
  const isBrand = hasActiveBrandMembership(user);
  const statusQuery = useStoreStatusQuery({ enabled: isBrand });

  if (!isBrand) return true;
  if (statusQuery.data) {
    cachedSetupComplete = statusQuery.data.isSetupComplete;
    cacheTime = Date.now();
    return statusQuery.data.isSetupComplete;
  }
  if (cachedSetupComplete !== null && Date.now() - cacheTime < CACHE_TTL) {
    return cachedSetupComplete;
  }
  if (statusQuery.error) {
    return false;
  }
  return null;
}
