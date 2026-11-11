import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { isBrandAccount } from '@/lib/brandAccess';
import { useStoreStatusQuery } from '@/query/queries';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import type { StoreStatusResponse } from '@/api/StoreApi';

export function invalidateStoreSetupStatusCache(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.store.status() });
}

/** Only update this actor's known snapshot; never invent a complete status. */
export function primeStoreSetupStatusCache(complete: boolean, actorId: string, brandId: string | null): void {
  queryClient.setQueriesData<StoreStatusResponse>(
    { queryKey: queryKeys.store.status(actorId, brandId), exact: true },
    (previous) => previous ? { ...previous, isSetupComplete: complete } : undefined,
  );
}

export function useStoreSetupStatus(): boolean | null {
  const actor = useSelector((state: RootState) => state.user.profile);
  const brand = isBrandAccount(actor);
  const status = useStoreStatusQuery({ enabled: brand });
  if (!brand) return true;
  // Unknown remains unknown, including a failed first request. A known cached
  // snapshot stays visible during background refresh and temporary outages.
  return typeof status.data?.isSetupComplete === 'boolean' ? status.data.isSetupComplete : null;
}
