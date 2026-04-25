import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDetail from '@/pages/orders/OrderDetail';

const resolveOrderAccess = vi.fn();
const getMyOrder = vi.fn();
const confirmMyOrderDelivery = vi.fn();

vi.mock('@/api/StoreApi', () => ({
  resolveOrderAccess: (...args: unknown[]) => resolveOrderAccess(...args),
  getMyOrder: (...args: unknown[]) => getMyOrder(...args),
  confirmMyOrderDelivery: (...args: unknown[]) => confirmMyOrderDelivery(...args),
}));

vi.mock('@/hooks/useReviewRuntimeFlags', () => ({
  useReviewRuntimeFlags: () => ({
    flags: {
      writeEnabled: true,
    },
    isLoading: false,
  }),
}));

vi.mock('@/components/qr/LazyOrderQrCard', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/reviews/ReviewComposerModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/components/ImageWithFallback', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/components/loaders/VLoader', () => ({
  __esModule: true,
  default: () => <div>Loading</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveOrderAccess.mockResolvedValue({ destination: '/orders/order-1' });
    getMyOrder.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      paymentStatus: 'PAID',
      totalAmount: 89500,
      currency: 'NGN',
      createdAt: '2026-03-20T04:28:36.000Z',
      items: [
        {
          productId: 'product-1',
          name: 'Browns',
          quantity: 1,
          price: 87000,
          selectedSize: 'S',
          selectedColor: 'brown',
          thumbnail: 'https://example.com/item.jpg',
        },
      ],
      orderItems: [
        {
          orderItemId: 'item-1',
          productId: 'product-1',
          productName: 'Browns',
          selectedSize: 'S',
          selectedColor: 'brown',
          reviewState: 'NOT_DELIVERED',
        },
      ],
      brand: {
        logo: null,
      },
    });
    confirmMyOrderDelivery.mockResolvedValue(null);
  });

  it('renders the order detail without the conversation panel', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order-1']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMyOrder).toHaveBeenCalledWith('order-1');
    });

    expect(screen.getByText('Order QR Code')).toBeInTheDocument();
    expect(screen.getByText('Review status')).toBeInTheDocument();
    expect(screen.queryByText('Order conversation')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type a message for this order')).not.toBeInTheDocument();
  });
});
