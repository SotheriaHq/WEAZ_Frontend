import { defaultShouldDehydrateQuery, hydrate, type QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { isPersistableWiezQueryKey } from './queryKeys';

export const WIEZ_QUERY_CACHE_BUSTER = 'WIEZ-web-phase2-v3';
// 24h (was 30min): mobile browsers discard tabs constantly, so every reopen
// past maxAge was a full cold load with skeletons. Staleness is already
// handled by staleTime + silent SWR revalidation — old-but-present data
// paints instantly and refreshes in the background.
export const WIEZ_QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WIEZ_QUERY_CACHE_STORAGE_KEY = 'WIEZ_QUERY_CACHE_V1';

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

export const wiezQueryPersister = createSyncStoragePersister({
  storage: createSafeStorage(),
  key: WIEZ_QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1000,
  serialize: serializeWithinBudget,
});

/**
 * Data a screen shows only because nothing real has loaded yet (marked
 * `isFallback: true`, e.g. the Studio dashboard's empty overview) is never
 * written to disk — rehydrating it would show zeros as if they were real.
 */
const isFallbackData = (data: unknown) =>
  typeof data === 'object' && data !== null && (data as { isFallback?: unknown }).isFallback === true;

export const shouldDehydrateWiezQuery: typeof defaultShouldDehydrateQuery = (query) =>
  defaultShouldDehydrateQuery(query) &&
  isPersistableWiezQueryKey(query.queryKey) &&
  !isFallbackData(query.state.data);

let primed = false;

/**
 * Put the persisted cache into the query client BEFORE the first render.
 *
 * `PersistQueryClientProvider` restores asynchronously: the app renders once
 * with an empty cache, then the restore lands. With a synchronous store
 * (localStorage) that gap is a single frame, but it is a frame of empty
 * screen — inside the Studio WebView, where every app launch starts a fresh
 * document, it read as a flash before cached content appeared.
 *
 * Same acceptance rules as the provider's own restore (buster, maxAge), so the
 * provider's later restore finds the same data and changes nothing. Any
 * failure leaves the cache empty and the provider path as before.
 */
export function primeWiezQueryCacheFromStorage(
  client: QueryClient,
  now: number = Date.now(),
): boolean {
  if (primed) return false;
  primed = true;
  try {
    const restored = wiezQueryPersister.restoreClient();
    if (!restored || typeof (restored as Promise<unknown>).then === 'function') return false;
    const persisted = restored as PersistedClient;
    if (persisted.buster !== WIEZ_QUERY_CACHE_BUSTER) return false;
    if (!persisted.timestamp || now - persisted.timestamp > WIEZ_QUERY_CACHE_MAX_AGE_MS) return false;
    hydrate(client, persisted.clientState);
    return true;
  } catch {
    return false;
  }
}

/** Tests only. */
export function resetWiezQueryCachePrimeForTests() {
  primed = false;
}

export const purgeWebPersistedQueryCache = () => {
  try {
    void wiezQueryPersister.removeClient?.();
  } catch {
    // Persisted cache cleanup must never block logout.
  }

  try {
    getStorage()?.removeItem(WIEZ_QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
};
