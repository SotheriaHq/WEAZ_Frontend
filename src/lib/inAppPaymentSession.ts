export type InAppPaymentSession = {
  gateway?: string | null;
  providerAccessCode?: string | null;
};

export type ResolvedInAppPaymentSession = {
  accessCode: string;
};

export const IN_APP_PAYMENT_SESSION_ERROR =
  'WIEZ only supports secure in-app checkout sessions. Retry the payment from inside WIEZ.';

export const resolvePaymentGateway = (
  session: Pick<InAppPaymentSession, 'gateway'>,
): string => {
  const gateway = String(session.gateway ?? '').trim();
  return gateway || 'PAYSTACK';
};

export const resolveInAppPaymentSession = (
  session: Pick<InAppPaymentSession, 'providerAccessCode'>,
): ResolvedInAppPaymentSession => {
  const accessCode = String(session.providerAccessCode ?? '').trim();
  if (accessCode) {
    return { accessCode };
  }

  throw new Error(IN_APP_PAYMENT_SESSION_ERROR);
};

/**
 * What the client should actually DO with an initialized payment.
 *
 * An access code is only one of the shapes the gateway returns, and demanding
 * one unconditionally is what broke saved-card checkout: a saved card is charged
 * server-side through Paystack's `/charge` endpoint, which never mints an access
 * code (only `/transaction/initialize` does). The charge would be accepted — the
 * card really was debited — and the client would then throw
 * `IN_APP_PAYMENT_SESSION_ERROR` at the buyer, who was told the payment could
 * only happen in a secure window that could not exist for this path.
 *
 * The four real outcomes:
 *  - an access code  → open the inline popup (a new card, entered by the buyer)
 *  - an authorization URL → the issuer wants a 3-D Secure challenge
 *  - accepted, nothing to do → the gateway is confirming; go watch the reference
 *  - already terminal → settled or declined; never reopen a payment window
 */
export type PaymentLaunchCandidate = {
  providerAccessCode?: string | null;
  authorizationUrl?: string | null;
  status?: string | null;
};

export type PaymentLaunchPlan =
  | { kind: 'INLINE'; accessCode: string }
  | { kind: 'REDIRECT'; url: string }
  /** Accepted with no buyer action left; poll the reference until it settles. */
  | { kind: 'CONFIRM' }
  /** Already paid — go straight to the outcome, never to a payment window. */
  | { kind: 'SETTLED' }
  | { kind: 'FAILED'; message: string };

export const PAYMENT_ALREADY_DECLINED_MESSAGE =
  'This payment attempt was already declined. Start a new checkout to try again.';

const TERMINAL_FAILURE_STATUSES = new Set(['FAILED', 'CANCELLED', 'EXPIRED']);

export const resolvePaymentLaunchPlan = (
  candidate: PaymentLaunchCandidate,
): PaymentLaunchPlan => {
  const status = String(candidate.status ?? '').trim().toUpperCase();

  // Terminal states are checked FIRST: a settled or declined attempt must never
  // reopen a payment window, whatever stale access code is still attached to it.
  if (status === 'PAID') {
    return { kind: 'SETTLED' };
  }
  if (TERMINAL_FAILURE_STATUSES.has(status)) {
    return { kind: 'FAILED', message: PAYMENT_ALREADY_DECLINED_MESSAGE };
  }

  const accessCode = String(candidate.providerAccessCode ?? '').trim();
  if (accessCode) {
    return { kind: 'INLINE', accessCode };
  }

  const authorizationUrl = String(candidate.authorizationUrl ?? '').trim();
  if (authorizationUrl) {
    return { kind: 'REDIRECT', url: authorizationUrl };
  }

  return { kind: 'CONFIRM' };
};
