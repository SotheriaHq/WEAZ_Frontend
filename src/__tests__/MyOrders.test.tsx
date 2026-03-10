import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MyOrders from '@/pages/orders/MyOrders';
import { clearReviewRuntimeFlagsCache } from '@/hooks/useReviewRuntimeFlags';
import { reviewsApi } from '@/api/ReviewsApi';

const getMyOrders = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/api/StoreApi', () => ({
  getMyOrders: (...args: unknown[]) => getMyOrders(...args),
}));

vi.mock('@/components/reviews/ReviewComposerModal', () => ({
  default: () => null,
}));

vi.mock('@/api/ReviewsApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/ReviewsApi')>('@/api/ReviewsApi');
  return {
    ...actual,
    reviewsApi: {
      ...actual.reviewsApi,
      getRuntimeFlags: vi.fn(),
    },
  };
});

describe('MyOrders review CTA gating', () => {
  beforeEach(() => {
    clearReviewRuntimeFlagsCache();
    vi.clearAllMocks();
  });

  it('hides write review CTA when runtime write access is disabled', async () => {
    vi.mocked(reviewsApi.getRuntimeFlags).mockResolvedValue({
      readEnabled: true,
      writeEnabled: false,
      brandRepliesEnabled: false,
    });

    getMyOrders.mockResolvedValue({
      items: [
        {
          id: 'order-1',
          customerName: 'Buyer One',
          createdAt: '2026-03-10T10:00:00.000Z',
          items: [{ productId: 'product-1', name: 'Structured blazer', quantity: 1 }],
          orderItems: [
            {
              orderItemId: 'order-item-1',
              productId: 'product-1',
              productName: 'Structured blazer',
              reviewState: 'CAN_CREATE',
            },
          ],
          status: 'DELIVERED',
          currency: 'NGN',
          totalAmount: 1000,
        },
      ],
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <MyOrders />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMyOrders).toHaveBeenCalled();
    });

    expect(screen.queryByRole('button', { name: '⭐ Write review' })).not.toBeInTheDocument();
    expect(screen.getByText('Reviews are temporarily unavailable.')).toBeInTheDocument();
  });
});