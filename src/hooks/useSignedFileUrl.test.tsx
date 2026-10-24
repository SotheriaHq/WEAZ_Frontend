import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSignedFileUrlSessionCache, useSignedFileUrl } from './useSignedFileUrl';

const brandApiMock = vi.hoisted(() => ({
  getSignedMediaSourceUrl: vi.fn(),
  getPublicFileUrl: vi.fn(),
  getPrivateSignedFileUrl: vi.fn(),
  invalidateSignedUrlCache: vi.fn(),
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: brandApiMock,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSignedFileUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSignedFileUrlSessionCache();
    brandApiMock.getSignedMediaSourceUrl.mockResolvedValue(null);
    sessionStorage.clear();
  });

  it('resolves raw S3 banner URLs through file id instead of using the private URL directly', async () => {
    brandApiMock.getPublicFileUrl.mockResolvedValue(
      'https://signed.example.com/banner.jpg',
    );
    brandApiMock.getPrivateSignedFileUrl.mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useSignedFileUrl(
          'banner-file-id',
          'https://voguely.s3.eu-north-1.amazonaws.com/BANNER_IMAGE/user/banner.jpg',
        ),
      { wrapper: createWrapper() },
    );

    expect(result.current.url).not.toBe(
      'https://voguely.s3.eu-north-1.amazonaws.com/BANNER_IMAGE/user/banner.jpg',
    );

    await waitFor(() => {
      expect(result.current.url).toBe('https://signed.example.com/banner.jpg');
    });

    expect(brandApiMock.getPublicFileUrl).toHaveBeenCalledWith(
      'banner-file-id',
    );
  });
  afterEach(() => { vi.useRealTimers(); });
  it('renews a mounted gateway variant before expiry, without a file id', async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 9, 22, 12); vi.setSystemTime(now);
    const initial = `https://media.example.com/media/variant.webp?env=sit&method=GET&exp=${now/1000+300}&sig=old`;
    const fresh = initial.replace(`exp=${now/1000+300}`, `exp=${now/1000+600}`).replace('sig=old', 'sig=fresh');
    brandApiMock.getSignedMediaSourceUrl.mockResolvedValue(fresh);
    const { result } = renderHook(() => useSignedFileUrl(null, initial), { wrapper: createWrapper() });
    expect(result.current.url).toBe(initial);
    await act(async () => { await vi.advanceTimersByTimeAsync(270_000); });
    expect(result.current.url).toBe(fresh);
    expect(brandApiMock.getSignedMediaSourceUrl).toHaveBeenCalledWith(initial, { forceRefresh: true });
    expect(brandApiMock.getPublicFileUrl).not.toHaveBeenCalled();
  });
  it('renews after focus when background timers have not run', async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 9, 22, 12); vi.setSystemTime(now);
    const initial = `https://media.example.com/media/variant.webp?env=sit&method=GET&exp=${now/1000+300}&sig=old`;
    const fresh = initial.replace(`exp=${now/1000+300}`, `exp=${now/1000+900}`).replace('sig=old', 'sig=fresh');
    brandApiMock.getSignedMediaSourceUrl.mockResolvedValue(fresh);
    const { result } = renderHook(() => useSignedFileUrl(null, initial), { wrapper: createWrapper() });
    vi.setSystemTime(now + 400_000);
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(result.current.url).toBe(fresh);
  });
  it('does not retain an old account capability after cleanup', async () => {
    const initial = 'https://media.example.com/private?token=old-account';
    let release!: (value: string | null) => void;
    brandApiMock.getSignedMediaSourceUrl.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const { result, rerender } = renderHook(() => useSignedFileUrl(null, initial), { wrapper: createWrapper() });
    expect(result.current.url).toBe(initial);
    await act(async () => { clearSignedFileUrlSessionCache(); });
    expect(result.current.url).toBeNull();
    rerender();
    expect(result.current.url).toBeNull();
    await act(async () => { release(null); });
    expect(result.current.url).toBeNull();
  });

});
