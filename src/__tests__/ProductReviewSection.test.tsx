import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductReviewSection from '@/components/reviews/ProductReviewSection';
import reviewApi from '@/api/ReviewApi';

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

vi.mock('@/api/ReviewApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/ReviewApi')>('@/api/ReviewApi');
  return {
    ...actual,
    default: {
      getProductReviews: vi.fn(),
      updateReview: vi.fn(),
      deleteReview: vi.fn(),
    },
  };
});

describe('ProductReviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render reviews when read access is denied', async () => {
    vi.mocked(reviewApi.getProductReviews).mockRejectedValue({ status: 403 });

    render(<ProductReviewSection productId="product-1" />);

    await waitFor(() => {
      expect(reviewApi.getProductReviews).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByText('Verified buyer feedback')).not.toBeInTheDocument();
    });
  });

  it('shows a recoverable error when the reviews request fails', async () => {
    vi.mocked(reviewApi.getProductReviews).mockRejectedValue(new Error('network down'));

    render(<ProductReviewSection productId="product-1" />);

    await waitFor(() => {
      expect(reviewApi.getProductReviews).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Reviews are unavailable')).toBeInTheDocument();
    expect(screen.getByText('network down')).toBeInTheDocument();
  });
});
