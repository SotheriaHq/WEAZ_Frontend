import { getSecurityDeviceId } from '@/auth/securityDevice';
import { securityChallenges, securityIdentityFromToken, SecurityVerificationCancelled } from '@/auth/securityChallenge';
import { verifyChallengedRequest, type SecurityRequestState } from '@/auth/securityRequestRetry';
import { withSessionRefreshLock } from '@/auth/sessionRefreshLock';
import { isPasswordSessionRotation } from '@/auth/passwordSessionRotation';
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
const securityIdentity = (token: string | null) => securityIdentityFromToken(token, value => atob(value));
const currentSecurityIdentity = () => securityIdentity(volatileAccessToken);
export const getApiSecurityIdentity = currentSecurityIdentity;
/** Captured when a queued action starts; normal JWT refresh keeps this scope. */
export type SessionRequestConfig = import('axios').AxiosRequestConfig & { _securityIdentity?: string; _authScope: number };
export const getApiSessionScope = () => authScope;
const tokenListeners = new Set<() => void>();
export const subscribeAccessToken = (listener: () => void) => {
  tokenListeners.add(listener);
  return () => { tokenListeners.delete(listener); };
};
const notifyTokenListeners = () => {
  for (const listener of tokenListeners) {
    try { listener(); } catch { /* One observer must not break credential storage. */ }
  }
};
// A session generation survives routine JWT rotation, but never sign-out or a
// different sign-in. Retried requests keep their original generation.
let authScope = 0;
type SessionRequest = InternalAxiosRequestConfig & { _authScope?: number; _logoutToken?: string | null; _sessionLogout?: boolean };
const isBoundLogout = (config: SessionRequest) => Boolean(config._sessionLogout &&
  config.url === '/auth/logout' && String(config.method).toUpperCase() === 'POST');
const assertCurrentScope = (config: SessionRequest) => {
  if (isBoundLogout(config)) return;
  if (config._authScope !== undefined && config._authScope !== authScope)
    throw new SecurityVerificationCancelled('Your sign-in session changed. Start this action again.');
};

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
  if (securityIdentity(token) !== currentSecurityIdentity() ||
    (!securityIdentity(token) && volatileAccessToken !== token)) {
    authScope++;
    refreshPromise = null;
    securityChallenges.cancel();
  }
  const changedIdentity = volatileAccessToken !== token;
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
  volatileAccessToken = token;
  // A refresh returns a NEW token for the SAME person; only a genuine change of
  // subject needs the flush, but distinguishing the two here is not worth the
  // risk of getting it wrong, and a flush is cheap.
  if (changedIdentity) resetIdentityScopedCaches();
  if (changedIdentity) notifyTokenListeners();
};

export function acceptPasswordSessionRotation(previousToken: string | null, replacementToken: string): void {
  if (!previousToken || currentSecurityIdentity() !== securityIdentity(previousToken) ||
    !isPasswordSessionRotation(previousToken, replacementToken, value => atob(value)))
    throw new SecurityVerificationCancelled('Your password may have changed, but your sign-in session changed too. Sign in with the new password.');
  // Adoption happens only after the entire password/MFA request has resolved.
  // Ordinary refresh retains its strict same-revision identity check.
  persistAccessToken(replacementToken);
}

export const dropStoredAccessToken = () => {
  authScope++;
  refreshPromise = null;
  securityChallenges.cancel();
  volatileAccessToken = null;
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
  resetIdentityScopedCaches();
  notifyTokenListeners();
};

export const apiClient: AxiosInstance = axios.create(env.api.defaultConfig);
const refreshClient: AxiosInstance = axios.create(env.api.defaultConfig);

/** Capture the outgoing credential before asynchronous local cleanup. Never
 * renew logout as the account that signs in next. */
export const logoutCurrentSession = () => {
  const outgoing = volatileAccessToken;
  // During cookie bootstrap the access cookie may exist before the in-memory
  // token. Queue logout anyway, after the pending rotation and before sign-in.
  return apiClient.post('/auth/logout', {}, { _sessionLogout: true, _logoutToken: outgoing } as AxiosRequestConfig);
};

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
  return `${config?._authScope ?? authScope}|${config?.baseURL ?? ''}|${config?.url ?? ''}|${params}`;
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
    // A discarded response cannot retract an HttpOnly Set-Cookie. Serialize
    // sign-in/sign-out with refresh so a late rotation cannot overwrite them.
    if (String(config.url ?? '').startsWith('/auth/') &&
      String(config.method ?? 'get').toUpperCase() !== 'GET') {
      return withSessionRefreshLock(() => {
        assertCurrentScope(config);
        return send(config);
      });
    }
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
        if (getDedupeEntries.get(key)?.inFlight === promise) getDedupeEntries.set(key, {
          inFlight: null,
          response,
          settledAt: Date.now(),
        });
        return response;
      })
      .catch((err: unknown) => {
        if (getDedupeEntries.get(key)?.inFlight === promise) getDedupeEntries.delete(key);
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

const dispatchAuthExpired = (preserveSharedAuthStorage = false) => {
  try {
    window.dispatchEvent(new CustomEvent('auth:expired', { detail: { preserveSharedAuthStorage } }));
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
    const expectedScope = authScope;
    // Cookie restoration has not established ownership of shared localStorage.
    // Its rejection may clear this tab, never another tab's saved identity.
    const preserveSharedAuthStorage = !currentSecurityIdentity();
    const stillCurrent = () => expectedScope === authScope;
    const operation = (async () => {
      try {
        const response = await withSessionRefreshLock(() => {
          if (!stillCurrent()) throw new SecurityVerificationCancelled();
          return refreshClient.post('/auth/refresh', {});
        });
        if (!stillCurrent()) return null;
        const payload = unwrapApiResponse<AuthTokensResponse>(response.data);
        const token = payload?.accessToken ?? null;
        if (currentSecurityIdentity() && securityIdentity(token) !== currentSecurityIdentity()) {
          // Another tab may have replaced the cookie session. Never import its
          // identity into this tab's existing private state.
          dropStoredAccessToken();
          dispatchAuthExpired(true);
          return null;
        }
        if (token) {
          persistAccessToken(token);
        } else {
          dropStoredAccessToken();
          dispatchAuthExpired(preserveSharedAuthStorage);
        }
        return token;
      } catch (error) {
        if (!stillCurrent()) return null;
        consecutiveRefreshFailures += 1;
        lastRefreshFailureAt = Date.now();
        const status = Number((error as AxiosError)?.response?.status ?? 0);
        if (status === 401 || status === 403) {
          dropStoredAccessToken();
          dispatchAuthExpired(preserveSharedAuthStorage);
        }
        return null;
      }
    })();
    refreshPromise = operation;
    void operation.then(() => { if (refreshPromise === operation) refreshPromise = null; });
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

  if (String(config.url ?? '').startsWith('/auth/')) {
    const device = getSecurityDeviceId();
    if (device) headers.set('x-wiez-security-device', device);
  }
  const token = isBoundLogout(config as SessionRequest)
    ? (config as SessionRequest)._logoutToken : volatileAccessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (isBoundLogout(config as SessionRequest)) {
    headers.delete('Authorization');
  }

  config.headers = headers;
  return config;
};

apiClient.interceptors.request.use((config) => {
  const state = config as SessionRequest & SecurityRequestState;
  state._authScope ??= authScope;
  assertCurrentScope(state);
  if (state._securityIdentity && state._securityIdentity !== currentSecurityIdentity())
    throw new SecurityVerificationCancelled('Your sign-in session changed. Start this action again.');
  state._securityStartedAt = performance.now();
  return startNetworkTrace(attachRequestMetadata(config));
});

apiClient.interceptors.response.use(
  (response) => {
    finishNetworkTrace(response.config, response);
    assertCurrentScope(response.config as SessionRequest);

    /*
      A successful write invalidates the read cache. All of it.

      The GET settle window exists to collapse duplicate reads inside one
      render burst; it was never meant to answer a read that happens AFTER a
      write. Without this, a save followed by a re-read within the window is
      answered with pre-save data — which is exactly how a shopper could type
      their measurements into the bag fittings sheet, have them saved, and then
      be asked for the same measurements again by the custom-order composer,
      whose fields seeded from a profile fetched moments earlier.

      Clearing everything rather than guessing which reads a write affects: the
      window is three seconds, so the cost is at most a few redundant requests
      right after a mutation, and a resource-scoped guess would be wrong the
      first time a write changed something under a different path — an order
      that changes a bag count, a save that changes a saved-items list.
      Correctness is worth more here than a handful of coalesced GETs.
    */
    const method = String(response.config?.method ?? 'get').toUpperCase();
    if (method !== 'GET') invalidateGetDedupe();

    return response;
  },
  async (error: AxiosError) => {
    finishNetworkTrace(error.config, error.response, error);
    const { response, config } = error;
    if (config) assertCurrentScope(config as SessionRequest);
    if (!response || !config) {
      return Promise.reject(error);
    }

    const status = response.status;
    const originalRequest = config as InternalAxiosRequestConfig & SecurityRequestState & { _retry?: boolean };
    if (isBoundLogout(originalRequest as SessionRequest)) return Promise.reject(error);
    const sentToken = String(getHeaders(originalRequest).get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const sentIdentity = securityIdentity(sentToken);
    if (status === 428) {
      const verified = await verifyChallengedRequest(originalRequest, response.data, sentIdentity,
        currentSecurityIdentity, originalRequest.signal);
      if (verified) {
        const headers = getHeaders(originalRequest);
        headers.delete('x-wiez-action-proof');
        if (verified.proof) headers.set('x-wiez-action-proof', verified.proof);
        // Preserve the serialized body, quote and idempotency key exactly as sent.
        return apiClient(originalRequest);
      }
    }

    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      if (sentIdentity && sentIdentity !== currentSecurityIdentity())
        throw new SecurityVerificationCancelled();

      try {
        const newToken = await refreshAccessToken();
        // Cookie-backed bootstrap starts without an access token. Only its own
        // successful refresh may move this request into the restored session.
        if (newToken && !sentToken && newToken === volatileAccessToken)
          (originalRequest as SessionRequest)._authScope = authScope;
        assertCurrentScope(originalRequest as SessionRequest);

        if (!newToken) {
          return Promise.reject(error);
        }
        if (sentIdentity && sentIdentity !== securityIdentity(newToken))
          throw new SecurityVerificationCancelled();

        const headers = getHeaders(originalRequest);
        headers.set('Authorization', `Bearer ${newToken}`);
        originalRequest.headers = headers;

        return apiClient(originalRequest);
      } catch (refreshError) {
        if (refreshError instanceof SecurityVerificationCancelled) return Promise.reject(refreshError);
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
