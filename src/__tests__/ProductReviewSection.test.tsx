import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductReviewSection from '@/components/reviews/ProductReviewSection';
import { clearReviewRuntimeFlagsCache } from '@/hooks/useReviewRuntimeFlags';
import { reviewsApi } from '@/api/ReviewsApi';

vi.mock('react-redux', () => ({
  useSelector: vi.fn((selector: (state: { user: { isAuthenticated: boolean } }) => boolean) =>
    selector({ user: { isAuthenticated: false } }),
  ),
}));

vi.mock('@/components/ui/Modal', () => ({
  default: () => null,
}));

vi.mock('@/components/media/MediaRenderer', () => ({
  default: () => <div data-testid="media-renderer" />,
}));

vi.mock('@/api/ReviewsApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/ReviewsApi')>('@/api/ReviewsApi');
  return {
    ...actual,
    reviewsApi: {
      getRuntimeFlags: vi.fn(),
      getProductReviews: vi.fn(),
      addHelpfulVote: vi.fn(),
      removeHelpfulVote: vi.fn(),
      reportReview: vi.fn(),
    },
  };
});

describe('ProductReviewSection', () => {
  beforeEach(() => {
    clearReviewRuntimeFlagsCache();
    vi.clearAllMocks();
  });

  it('does not fetch or render reviews when read access is disabled at runtime', async () => {
    vi.mocked(reviewsApi.getRuntimeFlags).mockResolvedValue({
      readEnabled: false,
      writeEnabled: true,
      brandRepliesEnabled: true,
    });

    render(<ProductReviewSection productId="product-1" />);

    await waitFor(() => {
      expect(reviewsApi.getRuntimeFlags).toHaveBeenCalledTimes(1);
    });

    expect(reviewsApi.getProductReviews).not.toHaveBeenCalled();
    expect(screen.queryByText('Buyer feedback that stays tied to delivered orders.')).not.toBeInTheDocument();
  });

  it('fails closed when the runtime flag request fails', async () => {
    vi.mocked(reviewsApi.getRuntimeFlags).mockRejectedValue(new Error('network down'));

    render(<ProductReviewSection productId="product-1" />);

    await waitFor(() => {
      expect(reviewsApi.getRuntimeFlags).toHaveBeenCalledTimes(1);
    });

    expect(reviewsApi.getProductReviews).not.toHaveBeenCalled();
    expect(screen.queryByText('Buyer feedback that stays tied to delivered orders.')).not.toBeInTheDocument();
  });
});