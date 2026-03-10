import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { reviewsApi } from '@/api/ReviewsApi';
import { clearReviewRuntimeFlagsCache } from '@/hooks/useReviewRuntimeFlags';

vi.mock('@/components/ui/Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/media/MediaRenderer', () => ({
  default: () => <div data-testid="media-renderer" />,
}));

vi.mock('@/api/ReviewsApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/ReviewsApi')>('@/api/ReviewsApi');
  return {
    ...actual,
    reviewsApi: {
      ...actual.reviewsApi,
      getRuntimeFlags: vi.fn(),
      getMyReview: vi.fn(),
    },
  };
});

describe('ReviewComposerModal', () => {
  beforeEach(() => {
    clearReviewRuntimeFlagsCache();
    vi.clearAllMocks();
  });

  it('does not load an existing review when runtime write access is unavailable', async () => {
    const onClose = vi.fn();
    vi.mocked(reviewsApi.getRuntimeFlags).mockResolvedValue({
      readEnabled: true,
      writeEnabled: false,
      brandRepliesEnabled: false,
    });

    render(
      <ReviewComposerModal
        open
        onClose={onClose}
        orderItem={{
          orderItemId: 'order-item-1',
          productId: 'product-1',
          productName: 'Structured blazer',
        }}
        reviewId="review-1"
      />,
    );

    await waitFor(() => {
      expect(reviewsApi.getRuntimeFlags).toHaveBeenCalledTimes(1);
    });

    expect(reviewsApi.getMyReview).not.toHaveBeenCalled();
  });
});