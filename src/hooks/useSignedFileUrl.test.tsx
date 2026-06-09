import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignedFileUrl } from './useSignedFileUrl';

const brandApiMock = vi.hoisted(() => ({
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
});
