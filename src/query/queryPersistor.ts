import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { isPersistableThreadlyQueryKey } from './queryKeys';

export const THREADLY_QUERY_CACHE_BUSTER = 'Threadly-web-phase2-v1';
export const THREADLY_QUERY_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
export const THREADLY_QUERY_CACHE_STORAGE_KEY = 'THREADLY_QUERY_CACHE_V1';

const getStorage = () => (typeof window === 'undefined' ? undefined : window.localStorage);

export const threadlyQueryPersister = createSyncStoragePersister({
  storage: getStorage(),
  key: THREADLY_QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1000,
});

export const shouldDehydrateThreadlyQuery: typeof defaultShouldDehydrateQuery = (query) =>
  defaultShouldDehydrateQuery(query) && isPersistableThreadlyQueryKey(query.queryKey);

export const purgeWebPersistedQueryCache = () => {
  try {
    void threadlyQueryPersister.removeClient?.();
  } catch {
    // Persisted cache cleanup must never block logout.
  }

  try {
    getStorage()?.removeItem(THREADLY_QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
};
