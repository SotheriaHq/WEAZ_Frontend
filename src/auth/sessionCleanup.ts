import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { brandApi } from '@/api/BrandApi';
import { dropStoredAccessToken } from '@/api/httpClient';
import { env } from '@/config/env';
import { clearSignedFileUrlSessionCache } from '@/hooks/useSignedFileUrl';
import { ACTIVE_BRAND_STORAGE_KEY } from '@/lib/brandAccess';
import { disconnectSocket } from '@/lib/ws';
import { purgeWebPersistedQueryCache, THREADLY_QUERY_CACHE_STORAGE_KEY } from '@/query/queryPersistor';

const SIGNED_URL_SESSION_STORAGE_KEY = 'threadly_signed_url_cache';

const PRIVATE_QUERY_ROOTS = new Set([
  'auth',
  'user',
  'brand',
  'brandPrivateAccess',
  'store',
  'saved',
  'notifications',
  'messaging',
  'sizeFit',
  'customOrders',
]);

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

export const clearWebPrivateSessionState = async ({
  client,
}: {
  client?: QueryClient;
} = {}) => {
  dropStoredAccessToken();

  if (client) {
    purgeWebPrivateQueryCache(client);
  }

  purgeWebPersistedQueryCache();
  brandApi.invalidateSignedUrlCache();
  clearSignedFileUrlSessionCache();
  clearWebRealtimeSession();

  removeLocalStorageKeys([
    env.tokenStorageKey,
    env.userStorageKey,
    ACTIVE_BRAND_STORAGE_KEY,
    THREADLY_QUERY_CACHE_STORAGE_KEY,
  ]);
  removeSessionStorageKeys([SIGNED_URL_SESSION_STORAGE_KEY]);
};
