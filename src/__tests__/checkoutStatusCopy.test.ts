import { describe, expect, it } from 'vitest';
import {
  getCheckoutStatusCopy,
  isCheckoutPaymentMethod,
} from '../pages/checkout/checkoutStatusCopy';

describe('checkoutStatusCopy', () => {
  it('keeps surface-specific wording while sharing the same status semantics', () => {
    const returnCopy = getCheckoutStatusCopy('return', 'PAID');
    const confirmationCopy = getCheckoutStatusCopy('confirmation', 'PAID');

    expect(returnCopy.headline).toBe('Payment confirmed');
    expect(confirmationCopy.headline).toBe('Payment confirmed');
    expect(returnCopy.description).not.toBe(confirmationCopy.description);
    expect(returnCopy.emoji).toBe('✅');
    expect(confirmationCopy.emoji).toBe('✅');
  });

  it('preserves legacy checkout payment methods for compatibility', () => {
    expect(isCheckoutPaymentMethod('PAYSTACK')).toBe(true);
    expect(isCheckoutPaymentMethod('FLUTTERWAVE')).toBe(true);
    expect(isCheckoutPaymentMethod('BANK_TRANSFER')).toBe(true);
  });
});