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
    // A prime that is NEWER than the fetched data wins.
    //
    // Callers prime this after performing the very mutation that changes the
    // answer — publishing a store, saving the last required setting. Query data
    // fetched before that mutation is simply out of date, but it used to be
    // read first unconditionally, so `primeStoreSetupStatusCache(true)` was
    // dead code whenever a status response already existed (i.e. essentially
    // always). That is what left a freshly published, live store with every
    // studio nav item except Store disabled.
    if (
      cachedSetupComplete !== null &&
      cacheTime > (statusQuery.dataUpdatedAt ?? 0)
    ) {
      return cachedSetupComplete;
    }
    cachedSetupComplete = statusQuery.data.isSetupComplete;
    cacheTime = Date.now();
    return statusQuery.data.isSetupComplete;
  }
  if (cachedSetupComplete !== null && Date.now() - cacheTime < CACHE_TTL) {
    return cachedSetupComplete;
  }
  if (statusQuery.error) {
    // Never lock the studio because the status request failed.
    //
    // This returned `false`, and `StudioSidebar` disables every nav item whose
    // `requiresSetup` is true whenever this hook is `false` — which is all of
    // them except Store. So a single failed `/store/status` call (the axios
    // default times out at 15s, and the SIT box runs close to its memory
    // ceiling) presented a fully set-up, published brand with a dead sidebar:
    // pages still reachable by URL, but nothing clickable.
    //
    // `RequireStoreSetup` already takes the opposite stance and renders
    // children when its own status fetch errors. The sidebar disagreeing with
    // the route guard is what produced "the store is live but I can't get into
    // Studio". Nav is an affordance, not a security boundary — every studio
    // route re-checks on entry and the server re-checks on every write.
    return cachedSetupComplete ?? true;
  }
  return null;
}
