import type {
  BillingAddress,
  PaymentData,
  PaystackPaymentData,
  ShippingAddress,
} from '@/api/StoreApi';

export interface PaymentOptionMeta {
  value: keyof PaymentFormState;
  label: string;
  emoji: string;
  description: string;
}

export type PaymentFormErrors = Record<string, string>;
export type CardholderNameMatchMode = 'strict' | 'soft' | 'off';

let runtimeCardholderNameMatchMode: CardholderNameMatchMode | null = null;

export interface PaymentFormState {
  PAYSTACK: PaystackPaymentData;
}

export const CHECKOUT_PAYMENT_OPTIONS: PaymentOptionMeta[] = [
  {
    value: 'PAYSTACK',
    label: 'Card payment',
    emoji: '💳',
    description: 'Use a saved card or enter a new card on this payment step.',
  },
];

const EMPTY_BILLING_ADDRESS: BillingAddress = {
  firstName: '',
  lastName: '',
  street: '',
  apartment: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Nigeria',
};

const EMPTY_CARD_DRAFT: NonNullable<PaystackPaymentData['newCardDraft']> = {
  cardHolderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
};

const isPaystackPaymentData = (value: PaymentData): value is PaystackPaymentData =>
  value?.method === 'PAYSTACK';

const normalizeNameTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .sort();

const namesMatch = (left: string, right: string): boolean => {
  const leftTokens = normalizeNameTokens(left);
  const rightTokens = normalizeNameTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return true;
  }
  if (leftTokens.length !== rightTokens.length) {
    return false;
  }
  return leftTokens.every((token, index) => token === rightTokens[index]);
};

const namesSoftMatch = (left: string, right: string): boolean => {
  const leftTokens = normalizeNameTokens(left);
  const rightTokens = normalizeNameTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return true;
  }

  const rightTokenSet = new Set(rightTokens);
  return leftTokens.some((token) => rightTokenSet.has(token));
};

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const isLuhnValid = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (digits.length < 12) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const resolveFrontendEnvironmentMarker = (): string =>
  String(
    import.meta.env.VITE_APP_ENV ??
      import.meta.env.VITE_DEPLOY_ENV ??
      import.meta.env.VITE_NODE_ENV ??
      import.meta.env.MODE ??
      '',
  )
    .trim()
    .toLowerCase();

const resolveCardholderNameMatchMode = (): CardholderNameMatchMode => {
  if (runtimeCardholderNameMatchMode) {
    return runtimeCardholderNameMatchMode;
  }

  const configuredMode = String(
    import.meta.env.VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE ?? '',
  )
    .trim()
    .toLowerCase();

  if (configuredMode === 'strict' || configuredMode === 'soft' || configuredMode === 'off') {
    return configuredMode;
  }

  const envMarker = resolveFrontendEnvironmentMarker();
  if (['development', 'dev', 'test', 'qa', 'uat', 'local'].includes(envMarker)) {
    return 'soft';
  }

  return envMarker ? 'strict' : import.meta.env.DEV ? 'soft' : 'strict';
};

export const setRuntimeCardholderNameMatchMode = (
  mode: CardholderNameMatchMode | null | undefined,
) => {
  runtimeCardholderNameMatchMode =
    mode === 'strict' || mode === 'soft' || mode === 'off' ? mode : null;
};

export const getCardholderNameHelperText = (): string => {
  const mode = resolveCardholderNameMatchMode();
  if (mode === 'strict') {
    return 'Card holder name must match the billing name for this order.';
  }
  if (mode === 'soft') {
    return 'Card holder name should closely match the billing name for this order.';
  }
  return 'Card holder name is collected for payment validation and review.';
};

export function shippingToBillingAddress(address: ShippingAddress): BillingAddress {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    street: address.street,
    apartment: address.apartment ?? '',
    city: address.city,
    state: address.state,
    postalCode: address.postalCode ?? '',
    country: address.country,
  };
}

export function createInitialPaymentState(email: string, phone: string): PaymentFormState {
  return {
    PAYSTACK: {
      method: 'PAYSTACK',
      channel: 'CARD',
      email,
      phone,
      billingSameAsShipping: true,
      billingAddress: { ...EMPTY_BILLING_ADDRESS },
      consentAccepted: false,
      useSavedCard: false,
      saveNewCard: true,
      newCardDraft: { ...EMPTY_CARD_DRAFT },
      savedCardId: null,
      savedCardDisplay: null,
    },
  };
}

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function validateBillingAddress(
  address: BillingAddress | undefined,
  errors: PaymentFormErrors,
) {
  if (!address) {
    errors['billingAddress.street'] = 'Billing address is required';
    return;
  }

  if (!address.firstName.trim()) {
    errors['billingAddress.firstName'] = 'Billing first name is required';
  }
  if (!address.lastName.trim()) {
    errors['billingAddress.lastName'] = 'Billing last name is required';
  }
  if (!address.street.trim()) {
    errors['billingAddress.street'] = 'Billing street is required';
  }
  if (!address.city.trim()) {
    errors['billingAddress.city'] = 'Billing city is required';
  }
  if (!address.state.trim()) {
    errors['billingAddress.state'] = 'Billing state is required';
  }
  if (!address.country.trim()) {
    errors['billingAddress.country'] = 'Billing country is required';
  }
}

export function resolveBillingAddress(
  paymentData: Pick<PaystackPaymentData, 'billingSameAsShipping' | 'billingAddress'>,
  shippingAddress: ShippingAddress,
): BillingAddress {
  return paymentData.billingSameAsShipping
    ? shippingToBillingAddress(shippingAddress)
    : paymentData.billingAddress ?? { ...EMPTY_BILLING_ADDRESS };
}

function normalizeCardDraft(
  paymentData: Pick<PaystackPaymentData, 'newCardDraft'>,
): NonNullable<PaystackPaymentData['newCardDraft']> {
  return {
    cardHolderName: String(paymentData.newCardDraft?.cardHolderName ?? '').trim(),
    cardNumber: String(paymentData.newCardDraft?.cardNumber ?? ''),
    expiry: String(paymentData.newCardDraft?.expiry ?? '').trim(),
    cvv: String(paymentData.newCardDraft?.cvv ?? '').trim(),
  };
}

function hasRawCardDraft(
  paymentData: Pick<PaystackPaymentData, 'newCardDraft'>,
): boolean {
  const draft = normalizeCardDraft(paymentData);
  return [draft.cardHolderName, draft.cardNumber, draft.expiry, draft.cvv].some(
    (value) => value.trim().length > 0,
  );
}

function validateCardDraft(
  paymentData: PaystackPaymentData,
  shippingAddress: ShippingAddress,
  errors: PaymentFormErrors,
) {
  const draft = normalizeCardDraft(paymentData);
  const cardDigits = digitsOnly(draft.cardNumber);
  const cvvDigits = digitsOnly(draft.cvv);
  const expiryMatch = draft.expiry.match(/^(\d{2})\/(\d{2})$/);

  if (!draft.cardHolderName) {
    errors.cardHolderName = 'Card holder name is required';
  }

  const billingAddress = resolveBillingAddress(paymentData, shippingAddress);
  const billingName = `${billingAddress.firstName} ${billingAddress.lastName}`.trim();
  const nameMatchMode = resolveCardholderNameMatchMode();
  if (draft.cardHolderName && billingName && (nameMatchMode === 'strict' || nameMatchMode === 'soft')) {
    const isMatch =
      nameMatchMode === 'strict'
        ? namesMatch(draft.cardHolderName, billingName)
        : namesSoftMatch(draft.cardHolderName, billingName);

    if (!isMatch) {
      errors.cardHolderName =
        nameMatchMode === 'strict'
          ? 'Card holder name must match the billing name for this order'
          : 'Card holder name should closely match the billing name for this order';
    }
  }

  if (!cardDigits) {
    errors.cardNumber = 'Card number is required';
  } else if (cardDigits.length < 12 || cardDigits.length > 19 || !isLuhnValid(cardDigits)) {
    errors.cardNumber = 'Enter a valid card number';
  }

  if (!expiryMatch) {
    errors.expiry = 'Expiry must be in MM/YY format';
  } else {
    const month = Number(expiryMatch[1]);
    const year = Number(expiryMatch[2]);
    const now = new Date();
    const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59, 999);

    if (month < 1 || month > 12) {
      errors.expiry = 'Enter a valid expiry month';
    } else if (expiryDate.getTime() < now.getTime()) {
      errors.expiry = 'Card expiry date has passed';
    }
  }

  if (!cvvDigits) {
    errors.cvv = 'CVV is required';
  } else if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.cvv = 'CVV must be 3 or 4 digits';
  }
}

export function validatePaymentData(
  paymentMethod: string,
  paymentData: PaymentData,
  shippingAddress: ShippingAddress,
): PaymentFormErrors {
  const errors: PaymentFormErrors = {};

  if (!isPaystackPaymentData(paymentData) || paymentMethod !== 'PAYSTACK') {
    errors.method = 'Checkout only supports secure card payment right now';
    return errors;
  }

  if (!paymentData.email.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(paymentData.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (!paymentData.phone.trim()) {
    errors.phone = 'Phone number is required';
  }

  if (!shippingAddress.phone.trim()) {
    errors.phone = 'Add a valid shipping phone number first';
  }

  if (!paymentData.consentAccepted) {
    errors.consentAccepted = 'You must confirm the payment and verification terms';
  }

  if (!paymentData.billingSameAsShipping) {
    validateBillingAddress(paymentData.billingAddress, errors);
  }

  if (!['CARD', 'BANK_TRANSFER'].includes(paymentData.channel)) {
    errors.channel = 'Select a payment channel';
  }

  if (paymentData.channel === 'CARD' && paymentData.useSavedCard) {
    if (!String(paymentData.savedCardId ?? '').trim()) {
      errors.savedCardId = 'Select a saved card or switch to a new card';
    }
  } else if (paymentData.channel === 'CARD') {
    if (hasRawCardDraft(paymentData)) {
      validateCardDraft(paymentData, shippingAddress, errors);
    }
  }

  return errors;
}

export function buildContactInfo(
  paymentData: PaymentData,
  shippingAddress: ShippingAddress,
): Record<string, any> {
  const paystackData = isPaystackPaymentData(paymentData)
    ? paymentData
    : ({
        method: 'PAYSTACK',
        channel: 'CARD',
        email: '',
        phone: '',
        billingSameAsShipping: true,
        billingAddress: { ...EMPTY_BILLING_ADDRESS },
        consentAccepted: false,
        useSavedCard: false,
        saveNewCard: true,
        newCardDraft: { ...EMPTY_CARD_DRAFT },
        savedCardId: null,
        savedCardDisplay: null,
      } satisfies PaystackPaymentData);

  return {
    phone: paystackData.phone,
    email: paystackData.email,
    billingSameAsShipping: paystackData.billingSameAsShipping,
    billingAddress: resolveBillingAddress(paystackData, shippingAddress),
    channel: paystackData.channel,
  };
}

export function buildPaymentSubmissionData(
  paymentData: PaymentData,
  shippingAddress: ShippingAddress,
): PaymentData {
  const paystackData = isPaystackPaymentData(paymentData)
    ? paymentData
    : ({
        method: 'PAYSTACK',
        channel: 'CARD',
        email: '',
        phone: '',
        billingSameAsShipping: true,
        billingAddress: { ...EMPTY_BILLING_ADDRESS },
        consentAccepted: false,
        useSavedCard: false,
        saveNewCard: true,
        newCardDraft: { ...EMPTY_CARD_DRAFT },
        savedCardId: null,
        savedCardDisplay: null,
      } satisfies PaystackPaymentData);

  const draft = normalizeCardDraft(paystackData);

  return {
    method: 'PAYSTACK',
    channel: paystackData.channel,
    email: paystackData.email,
    phone: paystackData.phone,
    billingSameAsShipping: paystackData.billingSameAsShipping,
    billingAddress: resolveBillingAddress(paystackData, shippingAddress),
    consentAccepted: paystackData.consentAccepted,
    useSavedCard:
      paystackData.channel === 'CARD'
        ? Boolean(paystackData.useSavedCard && paystackData.savedCardId)
        : false,
    saveNewCard:
      paystackData.channel === 'CARD' && !paystackData.useSavedCard
        ? Boolean(paystackData.saveNewCard ?? true)
        : false,
    newCardDraft:
      paystackData.channel === 'CARD' &&
      !paystackData.useSavedCard &&
      hasRawCardDraft(paystackData)
        ? draft
        : null,
    savedCardId:
      paystackData.channel === 'CARD'
        ? paystackData.savedCardId ?? null
        : null,
    savedCardDisplay:
      paystackData.channel === 'CARD'
        ? paystackData.savedCardDisplay ?? null
        : null,
  } satisfies PaystackPaymentData;
}

export function getPaymentSummaryLines(
  paymentMethod: string,
  paymentData: PaymentData,
): string[] {
  const lines = [paymentData.email, paymentData.phone];

  if (!isPaystackPaymentData(paymentData) || paymentMethod !== 'PAYSTACK') {
    return lines.filter(Boolean);
  }

  lines.push('Secure card checkout');
  if (paymentData.channel === 'BANK_TRANSFER') {
    lines[lines.length - 1] = 'Hosted bank transfer checkout';
    lines.push('Transfer account details appear on the next secure step');
  } else if (paymentData.useSavedCard && paymentData.savedCardDisplay) {
    const brand = paymentData.savedCardDisplay.brand || 'Saved card';
    const bank = paymentData.savedCardDisplay.bank
      ? ` (${paymentData.savedCardDisplay.bank})`
      : '';
    lines.push(`${brand}${bank} ending ${paymentData.savedCardDisplay.last4}`);
    lines.push('Threadly will verify the saved-card authorization after you continue');
  } else {
    lines[lines.length - 1] = 'Card checkout';
    if (hasRawCardDraft(paymentData)) {
      const digits = digitsOnly(String(paymentData.newCardDraft?.cardNumber ?? ''));
      const last4 = digits.length >= 4 ? digits.slice(-4) : null;
      lines.push(last4 ? `New card ending ${last4}` : 'New card details entered');
      lines.push('Final bank verification can still open a secure provider window');
    } else {
      lines.push('New card will be entered inside Paystack secure checkout');
      lines.push('Card details stay inside the secure provider window');
    }
  }

  return lines.filter(Boolean);
}

export function getReviewCtaLabel(
  paymentMethod: string,
  paymentData: PaymentData,
): string {
  if (paymentMethod === 'PAYSTACK' && isPaystackPaymentData(paymentData)) {
    if (paymentData.channel === 'BANK_TRANSFER') {
      return 'Continue to transfer instructions';
    }
    if (paymentData.channel === 'CARD' && paymentData.useSavedCard && paymentData.savedCardId) {
      return 'Continue with saved card';
    }
    return 'Open secure card checkout';
  }

  return 'Continue to Secure Payment';
}
