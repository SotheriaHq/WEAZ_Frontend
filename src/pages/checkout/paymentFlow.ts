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

export interface PaymentFormState {
  PAYSTACK: PaystackPaymentData;
}

export const CHECKOUT_PAYMENT_OPTIONS: PaymentOptionMeta[] = [
  {
    value: 'PAYSTACK',
    label: 'Pay with Paystack',
    emoji: '💳',
    description: 'Choose hosted card checkout or hosted bank transfer for v1.',
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

const isPaystackPaymentData = (value: PaymentData): value is PaystackPaymentData =>
  value?.method === 'PAYSTACK';

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

export function validatePaymentData(
  paymentMethod: string,
  paymentData: PaymentData,
  shippingAddress: ShippingAddress,
): PaymentFormErrors {
  const errors: PaymentFormErrors = {};

  if (!isPaystackPaymentData(paymentData) || paymentMethod !== 'PAYSTACK') {
    errors.method = 'Checkout only supports Paystack right now';
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
    errors.channel = 'Select a Paystack payment channel';
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
      } satisfies PaystackPaymentData);

  return {
    method: 'PAYSTACK',
    channel: paystackData.channel,
    email: paystackData.email,
    phone: paystackData.phone,
    billingSameAsShipping: paystackData.billingSameAsShipping,
    billingAddress: resolveBillingAddress(paystackData, shippingAddress),
    consentAccepted: paystackData.consentAccepted,
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

  lines.push('Hosted card checkout via Paystack');
  if (paymentData.channel === 'BANK_TRANSFER') {
    lines[lines.length - 1] = 'Hosted bank transfer checkout via Paystack';
    lines.push('Paystack will show the transfer account details after redirect');
  }

  return lines.filter(Boolean);
}

export function getReviewCtaLabel(
  paymentMethod: string,
  paymentData: PaymentData,
): string {
  if (paymentMethod === 'PAYSTACK' && isPaystackPaymentData(paymentData)) {
    return 'Continue to Paystack';
  }

  return 'Continue to Secure Payment';
}
