export type InAppPaymentSession = {
  gateway?: string | null;
  providerAccessCode?: string | null;
};

export type ResolvedInAppPaymentSession = {
  accessCode: string;
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
  session: Pick<InAppPaymentSession, 'providerAccessCode'>,
): ResolvedInAppPaymentSession => {
  const accessCode = String(session.providerAccessCode ?? '').trim();
  if (accessCode) {
    return { accessCode };
  }

  throw new Error(IN_APP_PAYMENT_SESSION_ERROR);
};
