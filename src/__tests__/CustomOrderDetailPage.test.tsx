import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomOrderDetailPage from '@/pages/custom-orders/CustomOrderDetailPage';

const getById = vi.fn();
const confirmDelivery = vi.fn();
const reportIssue = vi.fn();
const cancelOrder = vi.fn();
const initializePayment = vi.fn();
const verifyPayment = vi.fn();
const respondToExtension = vi.fn();

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        profile: {
          email: 'buyer@example.com',
        },
      },
    }),
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrdersBuyerApi: {
    getById: (...args: unknown[]) => getById(...args),
    confirmDelivery: (...args: unknown[]) => confirmDelivery(...args),
    reportIssue: (...args: unknown[]) => reportIssue(...args),
    cancel: (...args: unknown[]) => cancelOrder(...args),
    initializePayment: (...args: unknown[]) => initializePayment(...args),
    verifyPayment: (...args: unknown[]) => verifyPayment(...args),
    respondToExtension: (...args: unknown[]) => respondToExtension(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const orderFixture = {
  id: 'order-12345678',
  status: 'DELIVERED_PENDING_BUYER_CONFIRMATION',
  paymentStatus: 'PAID',
  paymentReference: 'pay-ref-1',
  currentProgressStage: 'DELIVERED',
  promisedProductionAt: '2026-03-18T10:00:00.000Z',
  promisedDispatchAt: '2026-03-20T10:00:00.000Z',
  promisedDeliveryAt: '2026-03-22T10:00:00.000Z',
  buyerAcceptanceWindowEndsAt: '2026-03-25T10:00:00.000Z',
  measurementConfirmedAt: '2026-03-12T10:00:00.000Z',
  source: {
    title: 'Structured Occasion Dress',
    brandName: 'Ada Atelier',
  },
  buyerPriceSummary: {
    grandTotal: 185000,
    currency: 'NGN',
  },
  measurementSnapshot: {
    bust: 92,
    waist: 74,
  },
  progressEvents: [
    {
      id: 'progress-1',
      stage: 'DELIVERED',
      changedAt: '2026-03-21T10:00:00.000Z',
      staleThresholdAt: '2026-03-23T10:00:00.000Z',
      adminEscalatedAt: null,
      note: 'Delivered to buyer',
    },
  ],
  timelineEvents: [
    {
      id: 'timeline-1',
      eventType: 'ORDER_DELIVERED',
      createdAt: '2026-03-21T10:00:00.000Z',
      payloadJson: { carrier: 'DHL' },
    },
  ],
  extensionRequests: [
    {
      id: 'extension-1',
      targetType: 'DELIVERY',
      requestedExtraDays: 2,
      buyerResponseStatus: 'ACCEPTED',
      buyerCounterDays: null,
      reason: 'Courier delay',
      createdAt: '2026-03-19T10:00:00.000Z',
    },
  ],
  disputes: [],
  issues: [],
  internalPriceBreakdown: {
    production: 120000,
    delivery: 15000,
  },
} as any;

describe('CustomOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue(orderFixture);
    confirmDelivery.mockResolvedValue(orderFixture);
    reportIssue.mockResolvedValue(orderFixture);
    cancelOrder.mockResolvedValue(orderFixture);
    initializePayment.mockResolvedValue({ authorizationUrl: null });
    verifyPayment.mockResolvedValue(orderFixture);
    respondToExtension.mockResolvedValue(orderFixture);
  });

  it('renders the buyer tracking sections for a custom order', async () => {
    render(
      <MemoryRouter initialEntries={['/custom-orders/order-12345678']}>
        <Routes>
          <Route path="/custom-orders/:orderId" element={<CustomOrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Structured Occasion Dress')).toBeInTheDocument();
    });

    expect(screen.getByText('Order overview')).toBeInTheDocument();
    expect(screen.getByText('Production stage history')).toBeInTheDocument();
    expect(screen.getByText('Extension requests')).toBeInTheDocument();
    expect(screen.getByText('Buyer actions')).toBeInTheDocument();
  });

  it('confirms before reporting an issue', async () => {
    render(
      <MemoryRouter initialEntries={['/custom-orders/order-12345678']}>
        <Routes>
          <Route path="/custom-orders/:orderId" element={<CustomOrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buyer actions')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Describe the issue'), {
      target: { value: 'The delivered fit does not match the confirmed bust measurement.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report issue' }));

    expect(await screen.findByText('Report a delivery issue?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Report issue' }).at(-1)!);

    await waitFor(() => {
      expect(reportIssue).toHaveBeenCalledWith('order-12345678', {
        issueType: 'OTHER',
        description: 'The delivered fit does not match the confirmed bust measurement.',
      });
    });
  });

  it('disables issue reporting once the acceptance window has closed', async () => {
    getById.mockResolvedValue({
      ...orderFixture,
      buyerAcceptanceWindowEndsAt: '2026-03-01T10:00:00.000Z',
      status: 'COMPLETED',
    });

    render(
      <MemoryRouter initialEntries={['/custom-orders/order-12345678']}>
        <Routes>
          <Route path="/custom-orders/:orderId" element={<CustomOrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buyer actions')).toBeInTheDocument();
    });

    expect(screen.getByText('Delivery issues can only be reported while the buyer acceptance window is still open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report issue' })).toBeDisabled();
  });
});