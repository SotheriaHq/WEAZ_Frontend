import { describe, expect, it } from 'vitest';
import type { PaymentAttemptSummary } from '@/api/PaymentApi';
import {
  canOfferCustomOrderCardRetry,
  createCustomOrderRetryPaymentData,
  createRetryShippingAddress,
} from './paymentRetryFlow';

const baseCustomOrderAttempt: PaymentAttemptSummary = {
  paymentAttemptId: 'attempt-1',
  reference: 'TH-CO-123456',
  subjectType: 'CUSTOM_ORDER',
  customOrderId: 'custom-order-1',
  checkoutIntentId: 'intent-1',
  gateway: 'PAYSTACK',
  providerMode: 'live',
  paymentMethod: 'PAYSTACK',
  status: 'FAILED',
  currency: 'NGN',
  settlementCurrency: 'NGN',
  settlementAmount: 10000,
  channel: 'CARD',
  canRetry: true,
  canSimulate: false,
  orderIds: [],
  summary: {
    items: [],
    subtotal: 0,
    shippingCost: 0,
    discount: 0,
    grandTotal: 10000,
    shippingName: 'Test Buyer',
    shippingCity: 'Lagos',
    shippingState: 'Lagos',
  },
  paymentData: {
    method: 'PAYSTACK',
    channel: 'CARD',
    email: 'buyer@example.com',
    phone: '08030000000',
    billingSameAsShipping: true,
    billingAddress: {
      firstName: 'Test',
      lastName: 'Buyer',
      street: '10 Broad Street',
      apartment: '',
      city: 'Lagos',
      state: 'Lagos',
      postalCode: '100001',
      country: 'Nigeria',
    },
    consentAccepted: true,
    useSavedCard: false,
    saveNewCard: true,
    newCardDraft: {
      cardHolderName: 'Test Buyer',
      cardNumber: '4084 0840 8408 4081',
      expiry: '12/99',
      cvv: '408',
    },
    savedCardId: null,
    savedCardDisplay: null,
  },
};

describe('paymentRetryFlow', () => {
  it('offers retry only for failed custom-order Paystack card attempts', () => {
    expect(canOfferCustomOrderCardRetry(baseCustomOrderAttempt)).toBe(true);
    expect(
      canOfferCustomOrderCardRetry({
        ...baseCustomOrderAttempt,
        customOrderId: undefined,
      }),
    ).toBe(false);
    expect(
      canOfferCustomOrderCardRetry({
        ...baseCustomOrderAttempt,
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).toBe(false);
    expect(
      canOfferCustomOrderCardRetry({
        ...baseCustomOrderAttempt,
        paymentData: {
          ...(baseCustomOrderAttempt.paymentData as Record<string, unknown>),
          channel: 'BANK_TRANSFER',
        },
      }),
    ).toBe(false);
    expect(
      canOfferCustomOrderCardRetry({
        ...baseCustomOrderAttempt,
        paymentData: {
          ...(baseCustomOrderAttempt.paymentData as Record<string, unknown>),
          billingAddress: {
            firstName: '',
            lastName: '',
            street: '',
            apartment: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
          },
        },
      }),
    ).toBe(true);
  });

  it('clears local card fields before retrying a failed new-card attempt', () => {
    const retryPaymentData = createCustomOrderRetryPaymentData(baseCustomOrderAttempt);

    expect(retryPaymentData.email).toBe('buyer@example.com');
    expect(retryPaymentData.phone).toBe('08030000000');
    expect(retryPaymentData.billingAddress).toMatchObject({
      firstName: 'Test',
      lastName: 'Buyer',
      street: '10 Broad Street',
    });
    expect(retryPaymentData.useSavedCard).toBe(false);
    expect(retryPaymentData.newCardDraft).toBeNull();
  });

  it('builds a synthetic shipping address from the retry billing data', () => {
    const retryPaymentData = createCustomOrderRetryPaymentData(baseCustomOrderAttempt);
    const shippingAddress = createRetryShippingAddress(retryPaymentData);

    expect(shippingAddress).toMatchObject({
      firstName: 'Test',
      lastName: 'Buyer',
      street: '10 Broad Street',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      phone: '08030000000',
    });
  });

  it('hydrates fallback billing context from attempt summary when billing snapshot is missing', () => {
    const retryPaymentData = createCustomOrderRetryPaymentData({
      ...baseCustomOrderAttempt,
      paymentData: {
        ...(baseCustomOrderAttempt.paymentData as Record<string, unknown>),
        billingAddress: null,
      },
    });

    expect(retryPaymentData.billingSameAsShipping).toBe(true);
    expect(retryPaymentData.billingAddress).toMatchObject({
      firstName: 'Test',
      lastName: 'Buyer',
      street: 'Address on file',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    });
  });
});
