import { QueryClient } from '@tanstack/react-query';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dropStoredAccessTokenMock = vi.fn();
const invalidateSignedUrlCacheMock = vi.fn();
const disconnectSocketMock = vi.fn();

vi.mock('@/api/httpClient', () => ({
  dropStoredAccessToken: dropStoredAccessTokenMock,
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: {
    invalidateSignedUrlCache: invalidateSignedUrlCacheMock,
  },
}));

vi.mock('@/lib/ws', () => ({
  disconnectSocket: disconnectSocketMock,
}));

const loadCleanupModule = async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3040');
  vi.stubEnv('VITE_TOKEN_STORAGE_KEY', 'THREADLY_ACCESS_TOKEN');
  vi.stubEnv('VITE_USER_STORAGE_KEY', 'THREADLY_USER');
  return import('./sessionCleanup');
};

describe('clearWebPrivateSessionState', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears auth state, private query cache, persisted cache, storage, realtime, and media caches', async () => {
    const { clearWebPrivateSessionState } = await loadCleanupModule();
    const client = new QueryClient();

    client.setQueryData(['auth', 'profile'], { id: 'previous-user' });
    client.setQueryData(['notifications', 'unreadCount'], { count: 4 });
    client.setQueryData(['messaging', 'unreadCount'], { unreadCount: 2 });
    client.setQueryData(['store', 'cart'], { items: ['private-cart'] });
    client.setQueryData(['saved', 'batch', 'PRODUCT', ['product-1']], { isSaved: true });
    client.setQueryData(['media', 'signedUrl', 'private-file'], 'https://signed.example/private');
    client.setQueryData(['config', 'uploadLimits'], { maxBytes: 1_000_000 });

    localStorage.setItem('THREADLY_ACCESS_TOKEN', 'token');
    localStorage.setItem('THREADLY_USER', JSON.stringify({ id: 'previous-user' }));
    localStorage.setItem('THREADLY_QUERY_CACHE_V1', JSON.stringify({ private: true }));
    localStorage.setItem('threadly.activeBrandId', 'brand-1');
    sessionStorage.setItem('threadly_signed_url_cache', JSON.stringify({ file: 'signed-url' }));

    await clearWebPrivateSessionState({ client });

    expect(dropStoredAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(invalidateSignedUrlCacheMock).toHaveBeenCalledTimes(1);
    expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['auth', 'profile'])).toBeUndefined();
    expect(client.getQueryData(['notifications', 'unreadCount'])).toBeUndefined();
    expect(client.getQueryData(['messaging', 'unreadCount'])).toBeUndefined();
    expect(client.getQueryData(['store', 'cart'])).toBeUndefined();
    expect(client.getQueryData(['saved', 'batch', 'PRODUCT', ['product-1']])).toBeUndefined();
    expect(client.getQueryData(['media', 'signedUrl', 'private-file'])).toBeUndefined();
    expect(client.getQueryData(['config', 'uploadLimits'])).toEqual({ maxBytes: 1_000_000 });
    expect(localStorage.getItem('THREADLY_ACCESS_TOKEN')).toBeNull();
    expect(localStorage.getItem('THREADLY_USER')).toBeNull();
    expect(localStorage.getItem('THREADLY_QUERY_CACHE_V1')).toBeNull();
    expect(localStorage.getItem('threadly.activeBrandId')).toBeNull();
    expect(sessionStorage.getItem('threadly_signed_url_cache')).toBeNull();
  });

  it('uses the same cleanup function for failed refresh/auth-expired wiring', async () => {
    const authContextSource = await readFile(
      path.resolve(process.cwd(), 'src/context/AuthContext.tsx'),
      'utf8',
    );

    expect(authContextSource).toContain('clearWebPrivateSessionState');
    expect(authContextSource).toContain('const onAuthExpired = () =>');
    expect(authContextSource).toContain('void clearPrivateSession()');
    expect(authContextSource).toContain('const logout = () =>');
  });
});
