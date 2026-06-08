import type { PaymentAttemptStatus, PaymentNextAction } from '@/api/PaymentApi';
import type { CheckoutPaymentMethod, PaymentMethodType } from '@/api/StoreApi';

export type CheckoutStatusSurface = 'return' | 'confirmation';

export interface CheckoutStatusCopy {
  headline: string;
  description: string;
  emoji: string;
}

const HEADLINES: Record<string, string> = {
  PAID: 'Your order is placed successfully',
  FAILED: 'Payment failed',
  CANCELLED: 'Payment cancelled',
  EXPIRED: 'Payment expired',
  PROCESSING: 'Payment still processing',
  REQUIRES_ACTION: 'Continue your payment',
  PENDING: 'Complete your payment',
};

const RETURN_DESCRIPTIONS: Record<string, string> = {
  PAID: 'Thank you for shopping. WEAZ has confirmed your payment and finalized the order.',
  FAILED: 'The payment attempt ended in a failed state. You can retry from your order or switch methods.',
  CANCELLED: 'The payment attempt was cancelled before completion.',
  EXPIRED: 'The payment window expired before the payment was completed.',
  PROCESSING: 'The payment is still being processed. You can wait and verify again, or continue from your order later.',
  REQUIRES_ACTION: 'The provider still expects a customer action before the payment can settle.',
  PENDING: 'The payment is still pending confirmation.',
};

const CONFIRMATION_DESCRIPTIONS: Record<string, string> = {
  PAID: 'Your order is placed successfully, Thank you for shopping.',
  FAILED: 'This payment attempt ended in a failed state. You can retry later from your order.',
  CANCELLED: 'This payment attempt was cancelled before completion.',
  EXPIRED: 'This payment window expired before the order was paid.',
  PROCESSING: 'Payment is still processing. Check again shortly or continue from your orders page.',
  REQUIRES_ACTION: 'Use the remaining provider instructions below to finish the payment.',
  PENDING: 'Complete your payment.',
};

const nextActionEmojiByType: Record<string, string> = {
  BANK_TRANSFER_INSTRUCTIONS: '🏦',
  USSD_INSTRUCTIONS: '📲',
  MOBILE_MONEY_APPROVAL: '📱',
  BANK_ACCOUNT_AUTH: '🏛️',
};

function getBaseEmoji(status: string): string {
  switch (status) {
    case 'PAID':
      return '✅';
    case 'FAILED':
      return '⚠️';
    case 'CANCELLED':
      return '🛑';
    case 'EXPIRED':
      return '⏰';
    case 'PROCESSING':
      return '🌀';
    case 'REQUIRES_ACTION':
      return '👉';
    default:
      return '💳';
  }
}

export function getCheckoutStatusCopy(
  surface: CheckoutStatusSurface,
  status: PaymentAttemptStatus | 'PENDING' | string,
  nextAction?: PaymentNextAction,
): CheckoutStatusCopy {
  const normalizedStatus = String(status || 'PENDING').toUpperCase();
  const headline = nextAction?.title || HEADLINES[normalizedStatus] || HEADLINES.PENDING;
  const descriptionSource =
    surface === 'return' ? RETURN_DESCRIPTIONS : CONFIRMATION_DESCRIPTIONS;
  const description =
    nextAction?.description ||
    descriptionSource[normalizedStatus] ||
    descriptionSource.PENDING;
  const emoji = nextAction?.type
    ? nextActionEmojiByType[nextAction.type] || getBaseEmoji(normalizedStatus)
    : getBaseEmoji(normalizedStatus);

  return {
    headline,
    description,
    emoji,
  };
}

export function isCheckoutPaymentMethod(
  value: PaymentMethodType | undefined,
): value is CheckoutPaymentMethod {
  return value === 'PAYSTACK' || value === 'FLUTTERWAVE' || value === 'BANK_TRANSFER';
}