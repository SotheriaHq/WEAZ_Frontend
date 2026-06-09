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
    <img data-testid="rendered-media" src={src} alt={alt} />
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
        'src',
        'https://signed.example.com/banner.jpg',
      );
    });

    expect(brandApiMock.getSignedFileUrl).toHaveBeenCalledWith(
      'banner-file-id',
    );
    expect(screen.queryByTestId('fallback-avatar')).not.toBeInTheDocument();
  });
});
