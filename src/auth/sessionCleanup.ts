import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { brandApi } from '@/api/BrandApi';
import { dropStoredAccessToken } from '@/api/httpClient';
import { env } from '@/config/env';
import { clearSignedFileUrlSessionCache } from '@/hooks/useSignedFileUrl';
import { ACTIVE_BRAND_STORAGE_KEY } from '@/lib/brandAccess';
import { disconnectSocket } from '@/lib/ws';
import { purgeWebPersistedQueryCache, WIEZ_QUERY_CACHE_STORAGE_KEY } from '@/query/queryPersistor';
import { PRIVATE_QUERY_ROOTS } from '@/query/queryKeys';
import { clearWebMarketSignalQueue } from '@/services/marketSignalQueue';

const SIGNED_URL_SESSION_STORAGE_KEY = 'wiez_signed_url_cache';
const PENDING_BAG_ACTION_SESSION_STORAGE_KEY = 'wiez.pendingBagAction.v1';
const UNIFIED_CHECKOUT_QUEUE_SESSION_STORAGE_KEY = 'wiez.unifiedCheckout.queue.v1';

export const isWebPrivateSessionQueryKey = (queryKey: QueryKey) => {
  const [root, scope] = queryKey;
  if (typeof root !== 'string') return false;
  if (root === 'media') return scope === 'signedUrl';
  return PRIVATE_QUERY_ROOTS.has(root);
};

const removeLocalStorageKeys = (keys: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage cleanup must be best-effort.
  }
};

const removeSessionStorageKeys = (keys: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    for (const key of keys) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage cleanup must be best-effort.
  }
};

export const purgeWebPrivateQueryCache = (client: QueryClient) => {
  void client.cancelQueries({ predicate: (query) => isWebPrivateSessionQueryKey(query.queryKey) });
  client.removeQueries({ predicate: (query) => isWebPrivateSessionQueryKey(query.queryKey) });
};

export const clearWebRealtimeSession = () => {
  disconnectSocket();
};

/**
 * Everything one account cached, in memory and on disk, minus the credentials.
 *
 * Shared by sign-out and by an account change that arrives WITHOUT a sign-out
 * in this document: the app's Studio WebView is handed an account by code, so
 * when a different brand signs in on the phone, the WebView still holds the
 * previous brand's Studio caches (primed from disk at boot) and its selected
 * brand. Keys carry the user id, so nothing rendered across, but the previous
 * account's data must not stay on the device under the new one.
 */
export const clearWebPrivateCaches = (client?: QueryClient) => {
  if (client) {
    purgeWebPrivateQueryCache(client);
  }

  purgeWebPersistedQueryCache();
  brandApi.invalidateSignedUrlCache();
  clearSignedFileUrlSessionCache();
  clearWebMarketSignalQueue();

  removeLocalStorageKeys([ACTIVE_BRAND_STORAGE_KEY, WIEZ_QUERY_CACHE_STORAGE_KEY]);
  removeSessionStorageKeys([
    SIGNED_URL_SESSION_STORAGE_KEY,
    PENDING_BAG_ACTION_SESSION_STORAGE_KEY,
    UNIFIED_CHECKOUT_QUEUE_SESSION_STORAGE_KEY,
  ]);
};

/** The account stored in this document before a handoff, if any. */
export const readStoredWebUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(env.userStorageKey);
    if (!raw) return null;
    const id = (JSON.parse(raw) as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id.trim() ? id : null;
  } catch {
    return null;
  }
};

export const clearWebPrivateSessionState = async ({
  client,
  preserveSharedAuthStorage = false,
}: {
  client?: QueryClient;
  preserveSharedAuthStorage?: boolean;
} = {}) => {
  dropStoredAccessToken();
  clearWebPrivateCaches(client);
  clearWebRealtimeSession();
  if (!preserveSharedAuthStorage)
    removeLocalStorageKeys([env.tokenStorageKey, env.userStorageKey]);
};
