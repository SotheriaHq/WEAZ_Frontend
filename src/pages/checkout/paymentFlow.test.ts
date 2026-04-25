import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '@/api/StoreApi';
import {
  buildPaymentSubmissionData,
  createInitialPaymentState,
  getPaymentSummaryLines,
  getReviewCtaLabel,
  setRuntimeCardholderNameMatchMode,
  validatePaymentData,
} from './paymentFlow';

const shippingAddress: ShippingAddress = {
  firstName: 'Test',
  lastName: 'Buyer',
  street: '10 Broad Street',
  apartment: '',
  city: 'Lagos',
  state: 'Lagos',
  postalCode: '100001',
  country: 'Nigeria',
  phone: '08030000000',
};

afterEach(() => {
  setRuntimeCardholderNameMatchMode(null);
  vi.unstubAllEnvs();
});

describe('paymentFlow', () => {
  it('accepts a hosted new-card selection without local card fields', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: null,
    };

    expect(validatePaymentData('PAYSTACK', paymentData, shippingAddress)).toEqual({});
  });

  it('describes the hosted new-card path in the payment summary and CTA', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: null,
    };

    expect(getPaymentSummaryLines('PAYSTACK', paymentData)).toContain(
      'New card will be entered inside Paystack secure checkout',
    );
    expect(getPaymentSummaryLines('PAYSTACK', paymentData)).toContain(
      'Card details stay inside the secure provider window',
    );
    expect(getReviewCtaLabel('PAYSTACK', paymentData)).toBe('Open secure card checkout');
  });

  it('enforces the card-holder and billing-name match when strict mode is enabled', () => {
    vi.stubEnv('VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE', 'strict');

    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: {
        cardHolderName: 'Another Person',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
    };

    expect(validatePaymentData('PAYSTACK', paymentData, shippingAddress)).toMatchObject({
      cardHolderName: 'Card holder name must match the billing name for this order',
    });
  });

  it('falls back to the backend-style soft mode in qa-like environments', () => {
    vi.stubEnv('VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE', '');
    vi.stubEnv('VITE_APP_ENV', 'qa');

    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: {
        cardHolderName: 'Test Person',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
    };

    expect(validatePaymentData('PAYSTACK', paymentData, shippingAddress)).toEqual({});
  });

  it('rejects soft-mode name mismatch when there is no billing-name overlap', () => {
    vi.stubEnv('VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE', '');
    vi.stubEnv('VITE_APP_ENV', 'qa');

    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: {
        cardHolderName: 'Another Person',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
    };

    expect(validatePaymentData('PAYSTACK', paymentData, shippingAddress)).toMatchObject({
      cardHolderName: 'Card holder name should closely match the billing name for this order',
    });
  });

  it('keeps the bank-transfer CTA aligned with transfer instructions', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      channel: 'BANK_TRANSFER' as const,
      consentAccepted: true,
    };

    expect(getReviewCtaLabel('PAYSTACK', paymentData)).toBe(
      'Continue to transfer instructions',
    );
  });

  it('only submits the active saved-card or new-card payload for checkout', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');

    const newCardPayload = buildPaymentSubmissionData(
      {
        ...paymentState.PAYSTACK,
        consentAccepted: true,
        useSavedCard: false,
        newCardDraft: null,
      },
      shippingAddress,
    );

    expect(newCardPayload).toMatchObject({
      useSavedCard: false,
      saveNewCard: true,
      newCardDraft: null,
      savedCardId: null,
    });

    const savedCardPayload = buildPaymentSubmissionData(
      {
        ...paymentState.PAYSTACK,
        consentAccepted: true,
        useSavedCard: true,
        savedCardId: 'paystack-attempt-1',
        savedCardDisplay: {
          id: 'paystack-attempt-1',
          brand: 'Visa',
          bank: 'Test Bank',
          last4: '4081',
          expMonth: '12',
          expYear: '99',
          reusable: true,
          lastUsedAt: '2026-04-13T00:00:00.000Z',
        },
        newCardDraft: {
          cardHolderName: 'Test Buyer',
          cardNumber: '4084 0840 8408 4081',
          expiry: '12/99',
          cvv: '408',
        },
      },
      shippingAddress,
    );

    expect(savedCardPayload).toMatchObject({
      useSavedCard: true,
      saveNewCard: false,
      newCardDraft: null,
      savedCardId: 'paystack-attempt-1',
    });
  });
});
