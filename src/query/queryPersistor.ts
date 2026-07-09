import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { isPersistableThreadlyQueryKey } from './queryKeys';

export const THREADLY_QUERY_CACHE_BUSTER = 'Threadly-web-phase2-v3';
// 24h (was 30min): mobile browsers discard tabs constantly, so every reopen
// past maxAge was a full cold load with skeletons. Staleness is already
// handled by staleTime + silent SWR revalidation — old-but-present data
// paints instantly and refreshes in the background.
export const THREADLY_QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
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

// Feed/collection payloads carry 7-day signed S3 URLs (hundreds of chars per
// media item), so a browsed session can exceed the size budget. The previous
// behavior silently skipped persisting the WHOLE cache once over budget —
// killing warm reloads exactly for the heaviest users. Instead, drop the
// least-recently-updated queries until the snapshot fits (halving keeps this
// to <= ~8 stringify passes of a shrinking payload).
const serializeWithinBudget = (client: PersistedClient): string => {
  let serialized = JSON.stringify(client);
  if (serialized.length <= MAX_PERSISTED_CACHE_BYTES) {
    return serialized;
  }

  let queries = [...client.clientState.queries].sort(
    (a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0),
  );
  while (queries.length > 0 && serialized.length > MAX_PERSISTED_CACHE_BYTES) {
    queries = queries.slice(0, Math.floor(queries.length / 2));
    serialized = JSON.stringify({
      ...client,
      clientState: { ...client.clientState, queries },
    });
  }
  return serialized;
};

export const threadlyQueryPersister = createSyncStoragePersister({
  storage: createSafeStorage(),
  key: THREADLY_QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1000,
  serialize: serializeWithinBudget,
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
