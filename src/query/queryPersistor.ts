import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { isPersistableThreadlyQueryKey } from './queryKeys';

export const THREADLY_QUERY_CACHE_BUSTER = 'Threadly-web-phase2-v2';
export const THREADLY_QUERY_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
export const THREADLY_QUERY_CACHE_STORAGE_KEY = 'THREADLY_QUERY_CACHE_V1';

const getStorage = () => (typeof window === 'undefined' ? undefined : window.localStorage);

const MAX_PERSISTED_CACHE_BYTES = 4 * 1024 * 1024;

const createSafeStorage = () => {
  const storage = getStorage();
  if (!storage) return storage;

  return {
    getItem: (key: string) => {
      try {
        const value = storage.getItem(key);
        if (!value || value.length <= MAX_PERSISTED_CACHE_BYTES) {
          return value;
        }
        storage.removeItem(key);
        return null;
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        if (value.length > MAX_PERSISTED_CACHE_BYTES) {
          return;
        }
        storage.setItem(key, value);
      } catch {
        // Storage can be unavailable or full on mobile browsers.
      }
    },
    removeItem: (key: string) => {
      try {
        storage.removeItem(key);
      } catch {
        // no-op
      }
    },
  };
};

export const threadlyQueryPersister = createSyncStoragePersister({
  storage: createSafeStorage(),
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
