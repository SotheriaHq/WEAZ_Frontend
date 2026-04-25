import { describe, expect, it } from 'vitest';
import {
  IN_APP_PAYMENT_SESSION_ERROR,
  resolveInAppPaymentSession,
  resolvePaymentGateway,
} from './inAppPaymentSession';

describe('inAppPaymentSession', () => {
  it('returns the inline access code when present', () => {
    expect(
      resolveInAppPaymentSession({
        providerAccessCode: '  ACCESS-CODE  ',
      }),
    ).toEqual({
      accessCode: 'ACCESS-CODE',
    });
  });

  it('throws when no in-app session details are present', () => {
    expect(() =>
      resolveInAppPaymentSession({
        providerAccessCode: '',
      }),
    ).toThrow(IN_APP_PAYMENT_SESSION_ERROR);
  });

  it('falls back to PAYSTACK when gateway is missing', () => {
    expect(resolvePaymentGateway({ gateway: '' })).toBe('PAYSTACK');
  });
});
