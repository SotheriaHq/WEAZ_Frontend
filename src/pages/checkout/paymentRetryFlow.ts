import type { BillingAddress, PaystackPaymentData, ShippingAddress } from '@/api/StoreApi';
import type { PaymentAttemptSummary } from '@/api/PaymentApi';
import { createInitialPaymentState } from './paymentFlow';

const RETRYABLE_STATUSES = new Set(['FAILED', 'CANCELLED', 'EXPIRED']);

const EMPTY_BILLING_ADDRESS: BillingAddress = {
  firstName: '',
  lastName: '',
  street: '',
  apartment: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

const EMPTY_CARD_DRAFT = {
  cardHolderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const asTrimmedString = (value: unknown): string => String(value ?? '').trim();

const normalizeStatus = (value: unknown): string => asTrimmedString(value).toUpperCase();

const toBillingAddress = (value: unknown): BillingAddress => {
  const address = asRecord(value);

  return {
    firstName: asTrimmedString(address.firstName),
    lastName: asTrimmedString(address.lastName),
    street: asTrimmedString(address.street),
    apartment: asTrimmedString(address.apartment),
    city: asTrimmedString(address.city),
    state: asTrimmedString(address.state),
    postalCode: asTrimmedString(address.postalCode),
    country: asTrimmedString(address.country),
  };
};

const hasBillingAddress = (address: BillingAddress): boolean =>
  [
    address.firstName,
    address.lastName,
    address.street,
    address.apartment,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].some((value) => Boolean(String(value ?? '').trim()));

const splitFullName = (value: string): { firstName: string; lastName: string } => {
  const tokens = asTrimmedString(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { firstName: '', lastName: '' };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' ') || tokens[0],
  };
};

const createFallbackBillingAddress = (attempt: PaymentAttemptSummary): BillingAddress => {
  const summary = attempt.summary;
  const shippingName = asTrimmedString(summary?.shippingName);
  const splitName = splitFullName(shippingName);

  return {
    firstName: splitName.firstName,
    lastName: splitName.lastName,
    street: 'Address on file',
    apartment: '',
    city: asTrimmedString(summary?.shippingCity),
    state: asTrimmedString(summary?.shippingState),
    postalCode: '',
    country: 'Nigeria',
  };
};

const toSavedCardDisplay = (
  value: unknown,
): NonNullable<PaystackPaymentData['savedCardDisplay']> | null => {
  const display = asRecord(value);
  const id = asTrimmedString(display.id);

  if (!id) {
    return null;
  }

  return {
    id,
    brand: asTrimmedString(display.brand) || null,
    bank: asTrimmedString(display.bank) || null,
    last4: asTrimmedString(display.last4),
    expMonth: asTrimmedString(display.expMonth) || null,
    expYear: asTrimmedString(display.expYear) || null,
    reusable: Boolean(display.reusable),
    lastUsedAt: asTrimmedString(display.lastUsedAt),
  };
};

export const canOfferCustomOrderCardRetry = (
  attempt: PaymentAttemptSummary | null,
): boolean => {
  if (!attempt || attempt.subjectType !== 'CUSTOM_ORDER' || !attempt.checkoutIntentId) {
    return false;
  }

  if (attempt.paymentMethod !== 'PAYSTACK') {
    return false;
  }

  if (attempt.customOrderId) {
    return false;
  }

  const channel = normalizeStatus(asRecord(attempt.paymentData).channel ?? attempt.channel ?? '');

  return channel === 'CARD' && RETRYABLE_STATUSES.has(normalizeStatus(attempt.status));
};

export const createCustomOrderRetryPaymentData = (
  attempt: PaymentAttemptSummary,
): PaystackPaymentData => {
  const paymentData = asRecord(attempt.paymentData);
  const base = createInitialPaymentState(
    asTrimmedString(paymentData.email),
    asTrimmedString(paymentData.phone),
  ).PAYSTACK;
  const snapshotBillingAddress = toBillingAddress(paymentData.billingAddress);
  const hasSnapshotBillingAddress = hasBillingAddress(snapshotBillingAddress);
  const billingAddress = hasSnapshotBillingAddress
    ? snapshotBillingAddress
    : createFallbackBillingAddress(attempt);
  const useSavedCard = Boolean(paymentData.useSavedCard && asTrimmedString(paymentData.savedCardId));

  return {
    ...base,
    channel: 'CARD',
    email: asTrimmedString(paymentData.email) || base.email,
    phone: asTrimmedString(paymentData.phone) || base.phone,
    billingAddress: hasBillingAddress(billingAddress)
      ? billingAddress
      : { ...EMPTY_BILLING_ADDRESS },
    billingSameAsShipping: hasSnapshotBillingAddress
      ? Boolean(paymentData.billingSameAsShipping ?? true)
      : true,
    consentAccepted: Boolean(paymentData.consentAccepted),
    useSavedCard,
    saveNewCard: Boolean(paymentData.saveNewCard ?? true),
    savedCardId: useSavedCard ? asTrimmedString(paymentData.savedCardId) : null,
    savedCardDisplay: useSavedCard ? toSavedCardDisplay(paymentData.savedCardDisplay) : null,
    newCardDraft: useSavedCard ? base.newCardDraft : { ...EMPTY_CARD_DRAFT },
  };
};

export const createRetryShippingAddress = (
  paymentData: PaystackPaymentData,
): ShippingAddress => {
  const billingAddress = toBillingAddress(paymentData.billingAddress);

  return {
    firstName: billingAddress.firstName,
    lastName: billingAddress.lastName,
    street: billingAddress.street,
    apartment: billingAddress.apartment,
    city: billingAddress.city,
    state: billingAddress.state,
    postalCode: billingAddress.postalCode,
    country: billingAddress.country,
    phone: asTrimmedString(paymentData.phone),
  };
};