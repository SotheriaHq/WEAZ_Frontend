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
      kind: 'access_code',
      accessCode: 'ACCESS-CODE',
    });
  });

  it('returns the hosted authorization URL when access code is unavailable', () => {
    expect(
      resolveInAppPaymentSession({
        providerAccessCode: '',
        authorizationUrl: 'https://checkout.paystack.com/example',
      }),
    ).toEqual({
      kind: 'hosted_url',
      authorizationUrl: 'https://checkout.paystack.com/example',
    });
  });

  it('throws when no in-app session details are present', () => {
    expect(() =>
      resolveInAppPaymentSession({
        providerAccessCode: '',
        authorizationUrl: '',
      }),
    ).toThrow(IN_APP_PAYMENT_SESSION_ERROR);
  });

  it('falls back to PAYSTACK when gateway is missing', () => {
    expect(resolvePaymentGateway({ gateway: '' })).toBe('PAYSTACK');
  });
});
