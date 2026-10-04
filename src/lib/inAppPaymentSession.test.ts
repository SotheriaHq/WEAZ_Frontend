import { describe, expect, it } from 'vitest';
import {
  IN_APP_PAYMENT_SESSION_ERROR,
  PAYMENT_ALREADY_DECLINED_MESSAGE,
  resolveInAppPaymentSession,
  resolvePaymentGateway,
  resolvePaymentLaunchPlan,
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

describe('resolvePaymentLaunchPlan', () => {
  it('opens the inline popup when the gateway minted an access code', () => {
    expect(
      resolvePaymentLaunchPlan({
        providerAccessCode: '  ACCESS-CODE  ',
        status: 'REQUIRES_ACTION',
      }),
    ).toEqual({ kind: 'INLINE', accessCode: 'ACCESS-CODE' });
  });

  /*
    The regression this exists for. A saved card is charged through Paystack's
    `/charge` endpoint, which returns no access code — only `/transaction/
    initialize` does. The old code demanded one unconditionally, so every
    saved-card checkout ended in "WIEZ only supports secure in-app checkout
    sessions" AFTER the card had already been charged.
  */
  it('confirms a saved-card charge that was accepted with nothing left to open', () => {
    expect(
      resolvePaymentLaunchPlan({
        providerAccessCode: null,
        authorizationUrl: null,
        status: 'PROCESSING',
      }),
    ).toEqual({ kind: 'CONFIRM' });
  });

  it('sends the buyer to the issuer challenge when one is required', () => {
    expect(
      resolvePaymentLaunchPlan({
        providerAccessCode: '',
        authorizationUrl: 'https://checkout.paystack.com/3ds/abc',
        status: 'REQUIRES_ACTION',
      }),
    ).toEqual({ kind: 'REDIRECT', url: 'https://checkout.paystack.com/3ds/abc' });
  });

  /*
    Terminal beats every launch shape: a stale access code hanging off a settled
    or declined attempt must never reopen a payment window and charge twice.
  */
  it('never reopens a payment window for a settled attempt', () => {
    expect(
      resolvePaymentLaunchPlan({
        providerAccessCode: 'STALE-ACCESS-CODE',
        status: 'PAID',
      }),
    ).toEqual({ kind: 'SETTLED' });
  });

  it.each(['FAILED', 'CANCELLED', 'EXPIRED'])(
    'reports %s without offering a window',
    (status) => {
      expect(
        resolvePaymentLaunchPlan({ providerAccessCode: 'STALE', status }),
      ).toEqual({ kind: 'FAILED', message: PAYMENT_ALREADY_DECLINED_MESSAGE });
    },
  );

  it('waits on confirmation when the gateway said nothing useful at all', () => {
    expect(resolvePaymentLaunchPlan({})).toEqual({ kind: 'CONFIRM' });
  });
});
