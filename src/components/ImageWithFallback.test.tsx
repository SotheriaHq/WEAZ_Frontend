import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageWithFallback from './ImageWithFallback';

const brandApiMock = vi.hoisted(() => ({
  getSignedFileUrl: vi.fn(),
  getSignedS3Url: vi.fn(),
  getSignedS3KeyUrl: vi.fn(),
  invalidateSignedUrlCache: vi.fn(),
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: brandApiMock,
}));

vi.mock('./media/MediaRenderer', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <div data-testid="rendered-media" data-src={src} aria-label={alt} />
  ),
}));

vi.mock('./DefaultAvatar', () => ({
  default: ({ name }: { name: string }) => <div data-testid="fallback-avatar">{name}</div>,
}));

describe('ImageWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not render a raw private S3 URL when a durable file id can resolve it', async () => {
    const rawS3Url =
      'https://voguely.s3.eu-north-1.amazonaws.com/BANNER_IMAGE/user/banner.jpg';
    brandApiMock.getSignedFileUrl.mockResolvedValue(
      'https://signed.example.com/banner.jpg',
    );

    render(
      <ImageWithFallback
        src={rawS3Url}
        fileId="banner-file-id"
        alt="Brand banner"
      />,
    );

    expect(screen.queryByTestId('rendered-media')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('rendered-media')).toHaveAttribute(
        'data-src',
        'https://signed.example.com/banner.jpg',
      );
    });

    expect(brandApiMock.getSignedFileUrl).toHaveBeenCalledWith(
      'banner-file-id',
    );
    expect(screen.queryByTestId('fallback-avatar')).not.toBeInTheDocument();
  });

  it('resolves an unsigned S3 URL before rendering media', async () => {
    const rawS3Url =
      'https://voguely.s3.eu-north-1.amazonaws.com/PROFILE_IMAGE/user/avatar.jpg';
    const signedUrl =
      'https://voguely.s3.eu-north-1.amazonaws.com/PROFILE_IMAGE/user/avatar.jpg?X-Amz-Signature=signed';
    brandApiMock.getSignedS3Url.mockResolvedValue(signedUrl);

    render(
      <ImageWithFallback
        src={rawS3Url}
        alt="Avery Cotour"
        fallbackName="Avery Cotour"
      />,
    );

    expect(screen.queryByTestId('rendered-media')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('rendered-media')).toHaveAttribute(
        'data-src',
        signedUrl,
      );
    });

    expect(brandApiMock.getSignedS3Url).toHaveBeenCalledWith(rawS3Url);
    expect(screen.getByTestId('rendered-media')).not.toHaveAttribute(
      'data-src',
      rawS3Url,
    );
  });

  it('falls back without rendering a raw S3 URL when signing fails', async () => {
    const rawS3Url =
      'https://voguely.s3.eu-north-1.amazonaws.com/PROFILE_IMAGE/user/missing-avatar.jpg';
    brandApiMock.getSignedS3Url.mockResolvedValue(null);

    render(
      <ImageWithFallback
        src={rawS3Url}
        alt="Avery Cotour"
        fallbackName="Avery Cotour"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('fallback-avatar')).toHaveTextContent(
        'Avery Cotour',
      );
    });

    expect(screen.queryByTestId('rendered-media')).not.toBeInTheDocument();
    expect(brandApiMock.getSignedS3Url).toHaveBeenCalledTimes(1);
  });

  it('resolves a raw storage key before rendering media', async () => {
    const rawStorageKey = 'PROFILE_IMAGE/user/key-avatar.jpg';
    const signedUrl =
      'https://voguely.s3.eu-north-1.amazonaws.com/PROFILE_IMAGE/user/key-avatar.jpg?X-Amz-Signature=signed';
    brandApiMock.getSignedS3KeyUrl.mockResolvedValue(signedUrl);

    render(
      <ImageWithFallback
        src={rawStorageKey}
        alt="Key Avatar"
        fallbackName="Key Avatar"
      />,
    );

    expect(screen.queryByTestId('rendered-media')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('rendered-media')).toHaveAttribute(
        'data-src',
        signedUrl,
      );
    });

    expect(brandApiMock.getSignedS3KeyUrl).toHaveBeenCalledWith(rawStorageKey);
  });

  it('renders a still-valid signed S3 URL directly', () => {
    const expires = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
    const signedUrl =
      `https://voguely.s3.eu-north-1.amazonaws.com/PROFILE_IMAGE/user/signed-avatar.jpg?X-Amz-Signature=signed&Expires=${expires}`;

    render(
      <ImageWithFallback
        src={signedUrl}
        alt="Signed Avatar"
        fallbackName="Signed Avatar"
      />,
    );

    expect(screen.getByTestId('rendered-media')).toHaveAttribute(
      'data-src',
      signedUrl,
    );
    expect(brandApiMock.getSignedS3Url).not.toHaveBeenCalled();
  });
});
