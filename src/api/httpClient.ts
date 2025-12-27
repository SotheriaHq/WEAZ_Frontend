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

const TOKEN_STORAGE_KEY = env.tokenStorageKey;

let authExpired = false;

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
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const persistAccessToken = (token: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  authExpired = false;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const dropStoredAccessToken = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export const apiClient: AxiosInstance = axios.create(env.api.defaultConfig);
const refreshClient: AxiosInstance = axios.create(env.api.defaultConfig);

let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = async (): Promise<string | null> => {
  if (authExpired) {
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
        }
        return token;
      } catch {
        authExpired = true;
        dropStoredAccessToken();
        try {
          // Broadcast a global auth-expired signal for UI to react (toast, redirect, etc.)
          window.dispatchEvent(new CustomEvent('auth:expired'));
        } catch {}
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  const token = getStoredAccessToken();
  if (!token) {
    return config;
  }

  const headers = getHeaders(config);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
  return config;
};

apiClient.interceptors.request.use(attachAuthHeader);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    if (!response || !config) {
      return Promise.reject(error);
    }

    const status = response.status;
    const originalRequest = config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      status === 401 &&
      !authExpired &&
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
        try { window.dispatchEvent(new CustomEvent('auth:expired')); } catch {}
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
