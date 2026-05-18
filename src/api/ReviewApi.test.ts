import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('./httpClient', () => ({
  apiClient: {
    get,
    post,
    patch,
    delete: del,
  },
}));

vi.mock('./idempotency', () => ({
  createIdempotencyKey: () => 'review-idem-key',
}));

import reviewApi from './ReviewApi';

const reviewPayload = {
  id: 'review-1',
  reviewerId: 'buyer-1',
  brandId: 'brand-1',
  productId: 'product-1',
  collectionId: null,
  legacyCollectionId: null,
  designId: null,
  orderId: 'order-1',
  orderItemId: 'item-1',
  customOrderId: null,
  targetType: 'PRODUCT',
  rating: 5,
  satisfaction: 'HAPPY',
  reviewText: 'Great fit.',
  verifiedPurchase: true,
  status: 'APPROVED',
  editWindowExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
  canEdit: true,
  canDelete: true,
};

describe('reviewApi lifecycle client', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
  });

  it('loads prompts from the lifecycle endpoint', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'prompt-1',
            buyerId: 'buyer-1',
            targetType: 'PRODUCT',
            status: 'PENDING',
            createdAt: '2026-05-18T10:00:00.000Z',
          },
        ],
      },
    });

    const prompts = await reviewApi.listReviewPrompts();

    expect(get).toHaveBeenCalledWith('/reviews/prompts');
    expect(prompts[0]).toMatchObject({ id: 'prompt-1', status: 'PENDING', targetType: 'PRODUCT' });
  });

  it('sends idempotency headers for submit, edit, delete, and skip', async () => {
    post.mockResolvedValue({ data: { data: reviewPayload } });
    patch.mockResolvedValue({ data: { data: reviewPayload } });
    del.mockResolvedValue({ data: null });

    await reviewApi.submitReview({
      promptId: 'prompt-1',
      targetType: 'PRODUCT',
      rating: 5,
      satisfaction: 'HAPPY',
    });
    await reviewApi.updateReview('review-1', { rating: 4 });
    await reviewApi.deleteReview('review-1');
    await reviewApi.skipReviewPrompt('prompt-1');

    expect(post).toHaveBeenCalledWith('/reviews', expect.any(Object), { headers: { 'Idempotency-Key': 'review-idem-key' } });
    expect(patch).toHaveBeenCalledWith('/reviews/review-1', { rating: 4 }, { headers: { 'Idempotency-Key': 'review-idem-key' } });
    expect(del).toHaveBeenCalledWith('/reviews/review-1', { headers: { 'Idempotency-Key': 'review-idem-key' } });
    expect(post).toHaveBeenCalledWith('/reviews/prompts/prompt-1/skip', {}, { headers: { 'Idempotency-Key': 'review-idem-key' } });
  });

  it('normalizes brand review lists and summary totals', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          items: [reviewPayload],
          summary: {
            averageRating: 5,
            reviewCount: 1,
            ratingBreakdown: { 5: 1 },
            satisfactionDistribution: { HAPPY: 1 },
          },
          nextCursor: null,
        },
      },
    });

    const result = await reviewApi.getBrandReviews('brand-1', undefined, 'buyer-1');

    expect(get).toHaveBeenCalledWith('/reviews/brand/brand-1', { params: undefined });
    expect(result.summary.reviewCount).toBe(1);
    expect(result.items[0].canEdit).toBe(true);
    expect(result.items[0].satisfaction).toBe('HAPPY');
  });

  it('loads the buyer My Reviews lifecycle endpoint', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          items: [
            {
              ...reviewPayload,
              target: { type: 'PRODUCT', id: 'product-1', name: 'Review Product' },
            },
          ],
          nextCursor: 'cursor-2',
        },
      },
    });

    const result = await reviewApi.getMyReviews({ limit: 25, targetType: 'PRODUCT' }, 'buyer-1');

    expect(get).toHaveBeenCalledWith('/reviews/me', { params: { limit: 25, targetType: 'PRODUCT' } });
    expect(result.nextCursor).toBe('cursor-2');
    expect(result.items[0].target?.name).toBe('Review Product');
    expect(result.items[0].canDelete).toBe(true);
  });

  it('loads the brand lifecycle dashboard and normalizes breakdown counts', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          items: [reviewPayload],
          summary: {
            averageRating: 4.5,
            reviewCount: 2,
            statusCounts: { APPROVED: 1, FLAGGED: 1 },
            targetTypeCounts: { PRODUCT: 2 },
            flaggedCount: 1,
          },
          breakdown: {
            targets: [
              { targetType: 'PRODUCT', targetId: 'product-1', name: 'Review Product', reviewCount: 2, averageRating: 4.5 },
            ],
          },
          nextCursor: null,
        },
      },
    });

    const result = await reviewApi.getBrandLifecycleDashboard({ status: 'FLAGGED' });

    expect(get).toHaveBeenCalledWith('/brands/reviews/lifecycle', { params: { status: 'FLAGGED' } });
    expect(result.summary.flaggedCount).toBe(1);
    expect(result.breakdown.targets[0]).toMatchObject({ name: 'Review Product', reviewCount: 2 });
  });

  it('reports a brand lifecycle review with idempotency headers', async () => {
    post.mockResolvedValueOnce({ data: { data: { ...reviewPayload, status: 'FLAGGED' } } });

    const result = await reviewApi.reportBrandLifecycleReview('review-1', {
      reason: 'OFF_TOPIC',
      details: 'Unrelated to the garment.',
    });

    expect(post).toHaveBeenCalledWith(
      '/brands/reviews/lifecycle/review-1/report',
      { reason: 'OFF_TOPIC', details: 'Unrelated to the garment.' },
      { headers: { 'Idempotency-Key': 'review-idem-key' } },
    );
    expect(result.status).toBe('FLAGGED');
  });
});
