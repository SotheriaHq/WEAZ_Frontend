import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '@/api/StoreApi';
import {
  buildPaymentSubmissionData,
  createInitialPaymentState,
  getPaymentSummaryLines,
  getReviewCtaLabel,
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
  vi.unstubAllEnvs();
});

describe('paymentFlow', () => {
  it('accepts a valid new-card draft on the payment step', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: {
        cardHolderName: 'Buyer Test',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
    };

    expect(validatePaymentData('PAYSTACK', paymentData, shippingAddress)).toEqual({});
  });

  it('describes the inline new-card path in the payment summary and CTA', () => {
    const paymentState = createInitialPaymentState('buyer@example.com', '08030000000');
    const paymentData = {
      ...paymentState.PAYSTACK,
      consentAccepted: true,
      useSavedCard: false,
      newCardDraft: {
        cardHolderName: 'Test Buyer',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
    };

    expect(getPaymentSummaryLines('PAYSTACK', paymentData)).toContain('New card ending 4081');
    expect(getPaymentSummaryLines('PAYSTACK', paymentData)).toContain(
      'Final bank verification can still open a secure provider window',
    );
    expect(getReviewCtaLabel('PAYSTACK', paymentData)).toBe('Continue to card verification');
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
        newCardDraft: {
          cardHolderName: 'Test Buyer',
          cardNumber: '4084 0840 8408 4081',
          expiry: '12/99',
          cvv: '408',
        },
      },
      shippingAddress,
    );

    expect(newCardPayload).toMatchObject({
      useSavedCard: false,
      saveNewCard: true,
      newCardDraft: {
        cardHolderName: 'Test Buyer',
        cardNumber: '4084 0840 8408 4081',
        expiry: '12/99',
        cvv: '408',
      },
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
