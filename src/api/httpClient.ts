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

export const persistAccessToken = (token: string) => {
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
  volatileAccessToken = token;
};

export const dropStoredAccessToken = () => {
  volatileAccessToken = null;
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
};

export const apiClient: AxiosInstance = axios.create(env.api.defaultConfig);
const refreshClient: AxiosInstance = axios.create(env.api.defaultConfig);

refreshClient.interceptors.request.use((config) => startNetworkTrace(config));
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

const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  const token = volatileAccessToken;
  if (!token) {
    return config;
  }

  const headers = getHeaders(config);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
  return config;
};

apiClient.interceptors.request.use((config) => startNetworkTrace(attachAuthHeader(config)));

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

    return Promise.reject(error);
  },
);
