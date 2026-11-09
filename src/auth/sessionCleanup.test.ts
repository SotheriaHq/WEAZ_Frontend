import { QueryClient } from '@tanstack/react-query';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dropStoredAccessTokenMock = vi.fn();
const invalidateSignedUrlCacheMock = vi.fn();
const disconnectSocketMock = vi.fn();
const clearWebMarketSignalQueueMock = vi.fn();

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

vi.mock('@/services/marketSignalQueue', () => ({
  clearWebMarketSignalQueue: clearWebMarketSignalQueueMock,
}));

const loadCleanupModule = async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3040');
  vi.stubEnv('VITE_TOKEN_STORAGE_KEY', 'WIEZ_ACCESS_TOKEN');
  vi.stubEnv('VITE_USER_STORAGE_KEY', 'WIEZ_USER');
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
    client.setQueryData(['store', 'cart', 'previous-user'], { items: ['private-cart'] });
    client.setQueryData(['saved', 'batch', 'previous-user', 'PRODUCT', ['product-1']], { isSaved: true });
    client.setQueryData(['media', 'signedUrl', 'private-file'], 'https://signed.example/private');
    client.setQueryData(['config', 'uploadLimits'], { maxBytes: 1_000_000 });

    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'token');
    localStorage.setItem('WIEZ_USER', JSON.stringify({ id: 'previous-user' }));
    localStorage.setItem('WIEZ_QUERY_CACHE_V1', JSON.stringify({ private: true }));
    localStorage.setItem('wiez.activeBrandId', 'brand-1');
    sessionStorage.setItem('wiez_signed_url_cache', JSON.stringify({ file: 'signed-url' }));
    sessionStorage.setItem('wiez.pendingBagAction.v1', JSON.stringify({ productId: 'product-1' }));
    sessionStorage.setItem('wiez.unifiedCheckout.queue.v1', JSON.stringify({ lines: [] }));

    await clearWebPrivateSessionState({ client });

    expect(dropStoredAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(invalidateSignedUrlCacheMock).toHaveBeenCalledTimes(1);
    expect(clearWebMarketSignalQueueMock).toHaveBeenCalledTimes(1);
    expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['auth', 'profile'])).toBeUndefined();
    expect(client.getQueryData(['notifications', 'unreadCount'])).toBeUndefined();
    expect(client.getQueryData(['messaging', 'unreadCount'])).toBeUndefined();
    expect(client.getQueryData(['store', 'cart', 'previous-user'])).toBeUndefined();
    expect(client.getQueryData(['saved', 'batch', 'previous-user', 'PRODUCT', ['product-1']])).toBeUndefined();
    expect(client.getQueryData(['media', 'signedUrl', 'private-file'])).toBeUndefined();
    expect(client.getQueryData(['config', 'uploadLimits'])).toEqual({ maxBytes: 1_000_000 });
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
    expect(localStorage.getItem('WIEZ_USER')).toBeNull();
    expect(localStorage.getItem('WIEZ_QUERY_CACHE_V1')).toBeNull();
    expect(localStorage.getItem('wiez.activeBrandId')).toBeNull();
    expect(sessionStorage.getItem('wiez_signed_url_cache')).toBeNull();
    expect(sessionStorage.getItem('wiez.pendingBagAction.v1')).toBeNull();
    expect(sessionStorage.getItem('wiez.unifiedCheckout.queue.v1')).toBeNull();
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

  it('removes all queue and billing data before another account can render it', async () => {
    const { clearWebPrivateSessionState } = await loadCleanupModule();
    const client = new QueryClient();
    const roots = ['brand-queue-subscription', 'subscription-store', 'subscription-compensations',
      'custom-order-queue-brand', 'admin-custom-order-queue-brand', 'custom-order-payment-queue',
      'admin-queue-refund-attention', 'queue-admin-tiers', 'queue-admin-campaigns', 'queue-admin-notices',
      'brand-runway-queue-notices'];
    for (const root of roots) client.setQueryData([root, 'previous-account'], { privateBalance: 500 });
    await clearWebPrivateSessionState({ client });
    for (const root of roots) expect(client.getQueryData([root, 'previous-account'])).toBeUndefined();
  });

  it('purges the Studio roots that used to outlive a sign-out', async () => {
    const { clearWebPrivateSessionState } = await loadCleanupModule();
    const client = new QueryClient();
    const roots = ['brand-customers', 'brand-commerce-access', 'brand-verification-status',
      'verification', 'admin', 'category-suggestions', 'design-create'];
    for (const root of roots) client.setQueryData([root, 'previous-account'], { customerEmail: 'a@b.c' });
    await clearWebPrivateSessionState({ client });
    for (const root of roots) expect(client.getQueryData([root, 'previous-account'])).toBeUndefined();
  });
});

describe('account change without a sign-out (Studio handoff)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('drops the previous account caches but keeps the new credentials', async () => {
    const { clearWebPrivateCaches } = await loadCleanupModule();
    const client = new QueryClient();
    client.setQueryData(['store', 'management', 'status', 'previous-user'], { brandId: 'brand-a' });
    client.setQueryData(['dashboard', 'home', 'previous-user'], { revenue: 900 });
    client.setQueryData(['config', 'uploadLimits'], { maxBytes: 1_000_000 });
    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'new-token');
    localStorage.setItem('WIEZ_USER', JSON.stringify({ id: 'previous-user' }));
    localStorage.setItem('WIEZ_QUERY_CACHE_V1', JSON.stringify({ private: true }));
    localStorage.setItem('wiez.activeBrandId', 'brand-a');

    clearWebPrivateCaches(client);

    expect(client.getQueryData(['store', 'management', 'status', 'previous-user'])).toBeUndefined();
    expect(client.getQueryData(['dashboard', 'home', 'previous-user'])).toBeUndefined();
    expect(client.getQueryData(['config', 'uploadLimits'])).toEqual({ maxBytes: 1_000_000 });
    expect(localStorage.getItem('WIEZ_QUERY_CACHE_V1')).toBeNull();
    expect(localStorage.getItem('wiez.activeBrandId')).toBeNull();
    // The handoff just stored these for the NEW account; they must survive.
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBe('new-token');
    expect(dropStoredAccessTokenMock).not.toHaveBeenCalled();
    expect(disconnectSocketMock).not.toHaveBeenCalled();
  });

  it('reads the stored account id, tolerating missing or broken storage', async () => {
    const { readStoredWebUserId } = await loadCleanupModule();
    expect(readStoredWebUserId()).toBeNull();
    localStorage.setItem('WIEZ_USER', '{not json');
    expect(readStoredWebUserId()).toBeNull();
    localStorage.setItem('WIEZ_USER', JSON.stringify({ id: 'user-1' }));
    expect(readStoredWebUserId()).toBe('user-1');
  });

  it('the Studio handoff purges only when a DIFFERENT account arrives', async () => {
    const gateSource = await readFile(
      path.resolve(process.cwd(), 'src/components/studio/StudioHandoffGate.tsx'),
      'utf8',
    );
    const readAt = gateSource.indexOf('const previousUserId = readStoredWebUserId()');
    const exchangeAt = gateSource.indexOf('await exchangeStudioHandoffOnce(');
    const purgeAt = gateSource.indexOf('clearWebPrivateCaches(queryClient)');
    const setUserAt = gateSource.indexOf('dispatch(setUser(user))');
    expect(readAt).toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(exchangeAt);
    expect(exchangeAt).toBeLessThan(purgeAt);
    expect(purgeAt).toBeLessThan(setUserAt);
    expect(gateSource).toContain('if (previousUserId && previousUserId !== user.id)');
  });
});
