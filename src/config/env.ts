import type { AxiosRequestConfig } from 'axios';

const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof fallback !== 'undefined') {
    if (import.meta.env.DEV) {
      console.warn(`Using fallback value for ${key}; configure this via environment variables for other environments.`);
    }
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${key}`);
};

const parseBoolean = (value: string): boolean => value.toLowerCase() === 'true';

const apiBaseUrl = getEnvVar('VITE_API_BASE_URL');
const appUrl = getEnvVar('VITE_APP_URL', '');
const tokenStorageKey = getEnvVar('VITE_TOKEN_STORAGE_KEY', 'THREADLY_ACCESS_TOKEN');
const userStorageKey = getEnvVar('VITE_USER_STORAGE_KEY', 'THREADLY_USER');
const brandEndpointsEnabled = parseBoolean(getEnvVar('VITE_ENABLE_BRAND_DETAIL_ENDPOINTS', 'true'));
const apiWithCredentials = parseBoolean(getEnvVar('VITE_API_WITH_CREDENTIALS', 'true'));
const googleClientId = getEnvVar('VITE_GOOGLE_CLIENT_ID', '');

export const env = {
  apiBaseUrl,
  appUrl,
  tokenStorageKey,
  userStorageKey,
  featureFlags: {
    brandDetailEndpoints: brandEndpointsEnabled,
  },
  google: {
    clientId: googleClientId,
    configured: googleClientId.length > 0 && !googleClientId.startsWith('<'),
  },
  api: {
    withCredentials: apiWithCredentials,
    defaultConfig: {
      baseURL: apiBaseUrl,
      withCredentials: apiWithCredentials,
    } as AxiosRequestConfig,
  },
} as const;
