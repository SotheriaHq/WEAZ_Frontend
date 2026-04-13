export type InAppPaymentSession = {
  gateway?: string | null;
  providerAccessCode?: string | null;
  authorizationUrl?: string | null;
};

export type ResolvedInAppPaymentSession =
  | {
      kind: 'access_code';
      accessCode: string;
    }
  | {
      kind: 'hosted_url';
      authorizationUrl: string;
    };

export const IN_APP_PAYMENT_SESSION_ERROR =
  'Threadly only supports secure in-app checkout sessions. Retry the payment from inside Threadly.';

export const resolvePaymentGateway = (
  session: Pick<InAppPaymentSession, 'gateway'>,
): string => {
  const gateway = String(session.gateway ?? '').trim();
  return gateway || 'PAYSTACK';
};

export const resolveInAppPaymentSession = (
  session: Pick<InAppPaymentSession, 'providerAccessCode' | 'authorizationUrl'>,
): ResolvedInAppPaymentSession => {
  const accessCode = String(session.providerAccessCode ?? '').trim();
  if (accessCode) {
    return {
      kind: 'access_code',
      accessCode,
    };
  }

  const authorizationUrl = String(session.authorizationUrl ?? '').trim();
  if (authorizationUrl) {
    return {
      kind: 'hosted_url',
      authorizationUrl,
    };
  }

  throw new Error(IN_APP_PAYMENT_SESSION_ERROR);
};
