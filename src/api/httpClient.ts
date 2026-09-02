import axios, { AxiosError, AxiosHeaders } from 'axios';
import type {
  AxiosHeaderValue,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { unwrapApiResponse } from '../types/auth';
import type { AuthTokensResponse } from '../types/auth';
import { env } from '../config/env';
import { finishNetworkTrace, startNetworkTrace } from './networkTrace';
import { createRequestId } from '../utils/requestId';
import { getWebDeviceId, WIEZ_DEVICE_ID_HEADER } from '../utils/deviceId';

let consecutiveRefreshFailures = 0;
let lastRefreshFailureAt = 0;
let volatileAccessToken: string | null = null;

const getHeaders = (config: AxiosRequestConfig): AxiosHeaders => {
  if (!config.headers) {
    const headers = new AxiosHeaders();
    config.headers = headers;
    return headers;
  }

  if (config.headers instanceof AxiosHeaders) {
    return config.headers;
  }

  const headers = new AxiosHeaders();
  const rawHeaders = config.headers as Record<string, AxiosHeaderValue | undefined>;
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value !== 'undefined') {
      headers.set(key, value);
    }
  }
  config.headers = headers;
  return headers;
};

export const getStoredAccessToken = (): string | null => {
  return volatileAccessToken;
};

/**
 * Identity changed — every cached read from the previous identity is now wrong.
 *
 * The GET coalescing below is keyed on URL and params, which is correct WITHIN
 * one signed-in identity and dangerously wrong across two. `/messaging/inbox` is
 * the same URL for every account, so signing out and straight back in as
 * somebody else could serve the previous account's inbox from the settle window
 * — one account's conversations appearing under another's name.
 *
 * Every identity transition therefore drops the whole map. It is a few
 * kilobytes of savings against showing a stranger someone else's messages.
 */
const resetIdentityScopedCaches = () => {
  invalidateGetDedupe();
};

export const persistAccessToken = (token: string) => {
  const changedIdentity = volatileAccessToken !== token;
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
  volatileAccessToken = token;
  // A refresh returns a NEW token for the SAME person; only a genuine change of
  // subject needs the flush, but distinguishing the two here is not worth the
  // risk of getting it wrong, and a flush is cheap.
  if (changedIdentity) resetIdentityScopedCaches();
};

export const dropStoredAccessToken = () => {
  volatileAccessToken = null;
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
  resetIdentityScopedCaches();
};

export const apiClient: AxiosInstance = axios.create(env.api.defaultConfig);
const refreshClient: AxiosInstance = axios.create(env.api.defaultConfig);

/* ══════════════════════════════════════════════════════════════════════════
   GET coalescing at the transport.

   The messages screen is the worst case and shows why this cannot live in the
   screens. `refresh()` there fans out to three endpoints, and it is called from
   five places: conversation change, an order-filter change, a 25s interval, a
   visibilitychange handler, and every socket message/thread event. None of those
   knows about the others, so a socket that delivers three frames in a second
   produces three identical triples. The server counts 87 `/threads/:id/messages`
   against 79 `/messaging/inbox` in one window; the throttler is 120/min for
   EVERYTHING, so the screen throttles itself and then reports the throttling as
   a toast per failed request.

   Sharing one in-flight GET removes the duplicates without a single screen
   changing. GET only — nothing that mutates is ever shared.
   ══════════════════════════════════════════════════════════════════════════ */
const GET_DEDUPE_WINDOW_MS = 3_000;

type GetDedupeEntry = {
  inFlight: Promise<unknown> | null;
  response?: unknown;
  settledAt?: number;
};

const getDedupeEntries = new Map<string, GetDedupeEntry>();

const buildGetDedupeKey = (config: any): string | null => {
  if (String(config?.method ?? 'get').toUpperCase() !== 'GET') return null;
  if (config?.signal) return null;
  if (config?.headers?.['x-no-dedupe']) return null;
  let params = '';
  try {
    params = config?.params ? JSON.stringify(config.params) : '';
  } catch {
    return null;
  }
  return `${config?.baseURL ?? ''}|${config?.url ?? ''}|${params}`;
};

export const invalidateGetDedupe = (urlFragment?: string) => {
  if (!urlFragment) {
    getDedupeEntries.clear();
    return;
  }
  for (const key of Array.from(getDedupeEntries.keys())) {
    if (key.includes(urlFragment)) getDedupeEntries.delete(key);
  }
};

/*
  `defaults.adapter` is a LIST OF ADAPTER NAMES in Axios v1 (`["xhr","http",
  "fetch"]`), not a function — calling it directly throws "Object is not a
  function" on every request. `axios.getAdapter` resolves it. Resolution is
  guarded so that if this shape ever changes again the optimization turns itself
  off instead of taking the whole transport down with it.
*/
let resolvedBaseAdapter: ((config: any) => Promise<any>) | null = null;
try {
  const candidate = (axios as any).getAdapter?.(
    apiClient.defaults.adapter ?? axios.defaults.adapter,
  );
  resolvedBaseAdapter = typeof candidate === 'function' ? candidate : null;
} catch {
  resolvedBaseAdapter = null;
}

if (resolvedBaseAdapter) {
  const send = resolvedBaseAdapter;
  apiClient.defaults.adapter = async function dedupingAdapter(config: any) {
    const key = buildGetDedupeKey(config);
    if (!key) return send(config);

    const entry = getDedupeEntries.get(key);
    if (entry?.inFlight) return entry.inFlight;
    if (
      entry?.settledAt != null &&
      entry.response !== undefined &&
      Date.now() - entry.settledAt < GET_DEDUPE_WINDOW_MS
    ) {
      return entry.response;
    }

    const promise = send(config)
      .then((response: unknown) => {
        getDedupeEntries.set(key, {
          inFlight: null,
          response,
          settledAt: Date.now(),
        });
        return response;
      })
      .catch((err: unknown) => {
        getDedupeEntries.delete(key);
        throw err;
      });

    getDedupeEntries.set(key, { inFlight: promise });
    return promise;
  };
}

/**
 * Rate-limit rejections are a condition, not an event.
 *
 * A 429 arrives once per in-flight request, so a burst produces a burst of
 * identical toasts — the "so many toasts" pile-up. `isRateLimited(error)` lets
 * callers recognise one and stay quiet; `shouldAnnounceRateLimit()` allows at
 * most one user-visible notice per window, so the app says it once.
 */
export const isRateLimited = (error: unknown): boolean =>
  (error as { response?: { status?: number } })?.response?.status === 429;

const RATE_LIMIT_NOTICE_INTERVAL_MS = 15_000;
let lastRateLimitNoticeAt = 0;

export const shouldAnnounceRateLimit = (): boolean => {
  const now = Date.now();
  if (now - lastRateLimitNoticeAt < RATE_LIMIT_NOTICE_INTERVAL_MS) return false;
  lastRateLimitNoticeAt = now;
  return true;
};

refreshClient.interceptors.request.use((config) =>
  startNetworkTrace(attachRequestMetadata(config)),
);
refreshClient.interceptors.response.use(
  (response) => {
    finishNetworkTrace(response.config, response);
    return response;
  },
  (error: AxiosError) => {
    finishNetworkTrace(error.config, error.response, error);
    return Promise.reject(error);
  },
);

let refreshPromise: Promise<string | null> | null = null;

const dispatchAuthExpired = () => {
  try {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  } catch {
    // Browser globals can be unavailable in tests or SSR-like contexts.
  }
};

export const refreshAccessToken = async (): Promise<string | null> => {
  const now = Date.now();
  if (
    consecutiveRefreshFailures >= 3 &&
    now - lastRefreshFailureAt < 30_000
  ) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await refreshClient.post('/auth/refresh', {});
        const payload = unwrapApiResponse<AuthTokensResponse>(response.data);
        const token = payload?.accessToken ?? null;
        if (token) {
          persistAccessToken(token);
        } else {
          dropStoredAccessToken();
          dispatchAuthExpired();
        }
        return token;
      } catch {
        consecutiveRefreshFailures += 1;
        lastRefreshFailureAt = Date.now();
        dropStoredAccessToken();
        dispatchAuthExpired();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const attachRequestMetadata = (config: InternalAxiosRequestConfig) => {
  const headers = getHeaders(config);
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', createRequestId());
  }

  // Durable, locally generated device id. The server uses it for exactly one
  // thing — suppressing a duplicate view count — so it never carries authority.
  // It is what keeps a view from being counted twice when the same person
  // views something signed out, signs in, and views it again: the user identity
  // changes, this does not.
  if (!headers.get(WIEZ_DEVICE_ID_HEADER)) {
    const deviceId = getWebDeviceId();
    if (deviceId) headers.set(WIEZ_DEVICE_ID_HEADER, deviceId);
  }

  const token = volatileAccessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
};

apiClient.interceptors.request.use((config) =>
  startNetworkTrace(attachRequestMetadata(config)),
);

apiClient.interceptors.response.use(
  (response) => {
    finishNetworkTrace(response.config, response);
    return response;
  },
  async (error: AxiosError) => {
    finishNetworkTrace(error.config, error.response, error);
    const { response, config } = error;
    if (!response || !config) {
      return Promise.reject(error);
    }

    const status = response.status;
    const originalRequest = config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();

        if (!newToken) {
          return Promise.reject(error);
        }

        const headers = getHeaders(originalRequest);
        headers.set('Authorization', `Bearer ${newToken}`);
        originalRequest.headers = headers;

        return apiClient(originalRequest);
      } catch (refreshError) {
        dispatchAuthExpired();
        return Promise.reject(refreshError);
      }
    }

    if (status === 429) {
      /*
        Mark it so callers can branch without re-deriving the status, and drop
        any coalesced GET for this URL — a throttled response must not be
        served from the short window as though it were real data.
      */
      (error as any).isRateLimited = true;
      const url = typeof config.url === 'string' ? config.url : undefined;
      if (url) invalidateGetDedupe(url);
    }

    return Promise.reject(error);
  },
);
