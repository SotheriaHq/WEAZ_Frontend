import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentAttemptSummary } from '@/api/PaymentApi';
import PaymentReturnPage from './PaymentReturnPage';

const dispatchMock = vi.fn();
const getPolicy = vi.fn();
const getAttempt = vi.fn();
const verifyWithStatus = vi.fn();
const verifyCustomOrderPayment = vi.fn();
const prepareForUnifiedCheckout = vi.fn();
const fetchCart = vi.fn(() => ({ type: 'cart/fetch' }));
const openCartDrawer = vi.fn(() => ({ type: 'cart/open' }));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatchMock,
}));

vi.mock('@/api/PaymentApi', () => ({
  paymentApi: {
    getPolicy: (...args: unknown[]) => getPolicy(...args),
    getAttempt: (...args: unknown[]) => getAttempt(...args),
    verifyWithStatus: (...args: unknown[]) => verifyWithStatus(...args),
  },
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrdersBuyerApi: {
    verifyPayment: (...args: unknown[]) => verifyCustomOrderPayment(...args),
    prepareForUnifiedCheckout: (...args: unknown[]) => prepareForUnifiedCheckout(...args),
  },
}));

vi.mock('@/features/cartSlice', () => ({
  fetchCart: (...args: unknown[]) => fetchCart(...args),
  openCartDrawer: (...args: unknown[]) => openCartDrawer(...args),
}));

vi.mock('@/pages/checkout/paymentFlow', () => ({
  setRuntimeCardholderNameMatchMode: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const paymentPolicy = {
  paystack: {
    customCardEntryEnabled: true,
    cardholderNameMatchMode: 'soft' as const,
    validationSessionRequired: false,
  },
  savedMethods: {
    canonicalEnabled: true,
  },
};

const failedCustomOrderAttempt: PaymentAttemptSummary = {
  paymentAttemptId: 'attempt-custom-failed-1',
  reference: 'TH-CO-failed-1',
  subjectType: 'CUSTOM_ORDER',
  customOrderId: 'custom-order-1',
  checkoutIntentId: 'checkout-intent-1',
  gateway: 'PAYSTACK',
  providerMode: 'live',
  paymentMethod: 'PAYSTACK',
  status: 'FAILED',
  currency: 'NGN',
  settlementCurrency: 'NGN',
  settlementAmount: 18000,
  channel: 'CARD',
  canRetry: true,
  canSimulate: false,
  orderIds: [],
  paymentData: {
    channel: 'CARD',
    email: 'buyer@example.com',
    phone: '08030000000',
    billingAddress: {
      firstName: 'Ada',
      lastName: 'Okafor',
      street: '42 Allen Avenue',
      apartment: '',
      city: 'Lagos',
      state: 'Lagos',
      postalCode: '100001',
      country: 'Nigeria',
    },
    useSavedCard: false,
    saveNewCard: true,
    consentAccepted: true,
  },
  summary: {
    items: [{ name: 'Custom blazer', quantity: 1, price: 18000 }],
    subtotal: 18000,
    shippingCost: 0,
    discount: 0,
    grandTotal: 18000,
    shippingName: 'Ada Okafor',
    shippingCity: 'Lagos',
    shippingState: 'Lagos',
  },
};

const paidUnifiedAttempt: PaymentAttemptSummary = {
  paymentAttemptId: 'attempt-unified-paid-1',
  reference: 'TH-UC-paid-1',
  subjectType: 'UNIFIED_CHECKOUT',
  checkoutSessionId: 'checkout-session-paid-1',
  gateway: 'PAYSTACK',
  providerMode: 'live',
  paymentMethod: 'PAYSTACK',
  status: 'PAID',
  currency: 'NGN',
  settlementCurrency: 'NGN',
  settlementAmount: 14500,
  channel: 'CARD',
  canRetry: false,
  canSimulate: false,
  orderIds: [],
  summary: {
    items: [{ name: 'Threadly Tee', quantity: 1, price: 12000 }],
    subtotal: 12000,
    shippingCost: 2500,
    discount: 0,
    grandTotal: 14500,
    shippingName: 'Ada Okafor',
    shippingCity: 'Lagos',
    shippingState: 'Lagos',
  },
};

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/bag/payment-return" element={<PaymentReturnPage />} />
        <Route path="/bag/confirmation" element={<div>Confirmation route</div>} />
        <Route path="/bag" element={<div>Bag route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentReturnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchMock.mockImplementation((action: unknown) => action);
    getPolicy.mockResolvedValue(paymentPolicy);
  });

  it('routes a failed custom-order retry back through bag checkout', async () => {
    getAttempt.mockResolvedValue(failedCustomOrderAttempt);
    verifyCustomOrderPayment.mockResolvedValue({
      success: false,
      status: 'FAILED',
      reference: failedCustomOrderAttempt.reference,
      paymentAttemptId: failedCustomOrderAttempt.paymentAttemptId,
      amount: 18000,
      currency: 'NGN',
      paidAt: null,
      channel: 'CARD',
      failureMessage: 'Card authorization failed.',
      recoveryMessage: 'Card authorization failed.',
      customOrderId: failedCustomOrderAttempt.customOrderId,
    });
    prepareForUnifiedCheckout.mockResolvedValue({
      customOrderId: failedCustomOrderAttempt.customOrderId,
      checkoutSessionId: 'checkout-session-1',
      checkoutIntentId: failedCustomOrderAttempt.checkoutIntentId,
      resumeUrl: '/bag/payment-return',
    });

    renderPage(
      `/bag/payment-return?reference=${encodeURIComponent(failedCustomOrderAttempt.reference)}&gateway=PAYSTACK`,
    );

    await waitFor(() => {
      expect(screen.getByText('Prepare in bag checkout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Prepare in bag checkout'));

    await waitFor(() => {
      expect(prepareForUnifiedCheckout).toHaveBeenCalledWith('custom-order-1');
    });

    expect(fetchCart).toHaveBeenCalledTimes(1);
    expect(openCartDrawer).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'cart/fetch' });
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'cart/open' });

    await waitFor(() => {
      expect(screen.getByText('Bag route')).toBeInTheDocument();
    });
  });

  it('routes a paid unified checkout attempt to confirmation', async () => {
    getAttempt
      .mockResolvedValueOnce(paidUnifiedAttempt)
      .mockResolvedValueOnce(paidUnifiedAttempt);
    verifyWithStatus.mockResolvedValue({
      success: true,
      status: 'PAID',
      reference: paidUnifiedAttempt.reference,
      paymentAttemptId: paidUnifiedAttempt.paymentAttemptId,
      amount: 14500,
      currency: 'NGN',
      settlementCurrency: 'NGN',
      settlementAmount: 14500,
      channel: 'CARD',
      checkoutSessionId: paidUnifiedAttempt.checkoutSessionId,
      summary: paidUnifiedAttempt.summary,
      orderIds: ['order-1'],
      customOrderIds: [],
    });

    renderPage(
      `/bag/payment-return?reference=${encodeURIComponent(paidUnifiedAttempt.reference)}&gateway=PAYSTACK`,
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmation route')).toBeInTheDocument();
    });

    expect(fetchCart).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'cart/fetch' });
  });
});
