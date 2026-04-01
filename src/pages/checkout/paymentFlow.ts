import type {
  BillingAddress,
  CheckoutPaymentMethod,
  DirectBankTransferPaymentData,
  FlutterwavePaymentChannel,
  FlutterwavePaymentData,
  PaystackPaymentData,
  PaymentData,
  ShippingAddress,
} from '@/api/StoreApi';

export interface PaymentOptionMeta {
  value: CheckoutPaymentMethod;
  label: string;
  emoji: string;
  description: string;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export type PaymentFormErrors = Record<string, string>;

export interface PaymentFormState {
  PAYSTACK: PaystackPaymentData;
  FLUTTERWAVE: FlutterwavePaymentData;
  BANK_TRANSFER: DirectBankTransferPaymentData;
}

export const CHECKOUT_PAYMENT_OPTIONS: PaymentOptionMeta[] = [
  {
    value: 'PAYSTACK',
    label: 'Pay with Paystack',
    emoji: '💳',
    description: 'Choose hosted card checkout or Paystack bank transfer for v1.',
  },
];

export const FLUTTERWAVE_CHANNEL_OPTIONS: Array<{
  value: FlutterwavePaymentChannel;
  label: string;
  emoji: string;
  description: string;
}> = [
  { value: 'CARD', label: 'Card checkout', emoji: '💳', description: 'Secure hosted card payment with OTP or 3DS when required.' },
  { value: 'BANK_TRANSFER', label: 'Virtual account transfer', emoji: '🏦', description: 'Receive a temporary account number for this order.' },
  { value: 'BANK_ACCOUNT', label: 'Pay with bank account', emoji: '🏛️', description: 'Provide bank account details and complete issuer authentication.' },
  { value: 'USSD', label: 'USSD payment', emoji: '📲', description: 'Dial a generated code from your phone and approve with bank PIN.' },
  { value: 'MOBILE_MONEY', label: 'Mobile money', emoji: '📱', description: 'Approve the payment prompt from your mobile wallet.' },
];

export const NIGERIAN_BANK_OPTIONS: SelectOption[] = [
  { value: '044', label: 'Access Bank' },
  { value: '014', label: 'Afribank / Mainstreet' },
  { value: '063', label: 'Access Diamond' },
  { value: '050', label: 'Ecobank Nigeria' },
  { value: '011', label: 'First Bank of Nigeria' },
  { value: '214', label: 'First City Monument Bank' },
  { value: '058', label: 'Guaranty Trust Bank' },
  { value: '033', label: 'United Bank for Africa' },
  { value: '232', label: 'Sterling Bank' },
  { value: '057', label: 'Zenith Bank' },
];

export const FLUTTERWAVE_USSD_BANKS: SelectOption[] = [
  { value: '737', label: 'Guaranty Trust Bank', description: 'Dial via the 737 USSD rail.' },
  { value: '919', label: 'United Bank for Africa', description: 'Dial via the 919 USSD rail.' },
  { value: '822', label: 'Sterling Bank', description: 'Dial via the 822 USSD rail.' },
  { value: '966', label: 'Zenith Bank', description: 'Dial via the 966 USSD rail.' },
];

export const MOBILE_MONEY_COUNTRY_OPTIONS: Array<SelectOption & { value: 'GH' | 'KE' }> = [
  { value: 'GH', label: 'Ghana' },
  { value: 'KE', label: 'Kenya' },
];

export const MOBILE_MONEY_NETWORKS: Record<'GH' | 'KE', SelectOption[]> = {
  GH: [
    { value: 'mtn', label: 'MTN Mobile Money' },
    { value: 'tgo', label: 'AirtelTigo Money' },
    { value: 'vod', label: 'Vodafone Cash' },
  ],
  KE: [
    { value: 'mpesa', label: 'M-Pesa' },
  ],
};

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
    FLUTTERWAVE: {
      method: 'FLUTTERWAVE',
      channel: 'CARD',
      email,
      phone,
      billingSameAsShipping: true,
      billingAddress: { ...EMPTY_BILLING_ADDRESS },
      consentAccepted: false,
      bankAccount: {
        bankCode: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
      },
      ussd: {
        bankCode: '',
        bankName: '',
      },
      mobileMoney: {
        countryCode: 'GH',
        networkId: '',
        networkName: '',
        phone: '',
      },
    },
    BANK_TRANSFER: {
      method: 'BANK_TRANSFER',
      channel: 'BANK_TRANSFER',
      email,
      phone,
      billingSameAsShipping: true,
      billingAddress: { ...EMPTY_BILLING_ADDRESS },
      consentAccepted: false,
      senderName: '',
      senderPhone: phone,
      senderBankName: '',
      transferPurpose: '',
    },
  };
}

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function validateBillingAddress(address: BillingAddress | undefined, errors: PaymentFormErrors) {
  if (!address) {
    errors['billingAddress.street'] = 'Billing address is required';
    return;
  }

  if (!address.firstName.trim()) errors['billingAddress.firstName'] = 'Billing first name is required';
  if (!address.lastName.trim()) errors['billingAddress.lastName'] = 'Billing last name is required';
  if (!address.street.trim()) errors['billingAddress.street'] = 'Billing street is required';
  if (!address.city.trim()) errors['billingAddress.city'] = 'Billing city is required';
  if (!address.state.trim()) errors['billingAddress.state'] = 'Billing state is required';
  if (!address.country.trim()) errors['billingAddress.country'] = 'Billing country is required';
}

export function resolveBillingAddress(paymentData: PaymentData, shippingAddress: ShippingAddress): BillingAddress {
  return paymentData.billingSameAsShipping
    ? shippingToBillingAddress(shippingAddress)
    : paymentData.billingAddress ?? { ...EMPTY_BILLING_ADDRESS };
}

export function validatePaymentData(
  paymentMethod: CheckoutPaymentMethod,
  paymentData: PaymentData,
  shippingAddress: ShippingAddress,
): PaymentFormErrors {
  const errors: PaymentFormErrors = {};

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

  if (paymentMethod === 'PAYSTACK') {
    const paystackData = paymentData as PaystackPaymentData;
    if (!['CARD', 'BANK_TRANSFER'].includes(paystackData.channel)) {
      errors.channel = 'Select a Paystack payment channel';
    }
  }

  if (paymentMethod === 'FLUTTERWAVE') {
    const flutterwaveData = paymentData as FlutterwavePaymentData;

    if (flutterwaveData.channel === 'BANK_ACCOUNT') {
      if (!flutterwaveData.bankAccount?.bankCode) errors['bankAccount.bankCode'] = 'Select a bank';
      if (!flutterwaveData.bankAccount?.accountNumber?.trim()) errors['bankAccount.accountNumber'] = 'Account number is required';
      if (!flutterwaveData.bankAccount?.accountName?.trim()) errors['bankAccount.accountName'] = 'Account name is required';
    }

    if (flutterwaveData.channel === 'USSD') {
      if (!flutterwaveData.ussd?.bankCode) errors['ussd.bankCode'] = 'Select a supported USSD bank';
    }

    if (flutterwaveData.channel === 'MOBILE_MONEY') {
      if (!flutterwaveData.mobileMoney?.networkId) errors['mobileMoney.networkId'] = 'Select a mobile money network';
      if (!flutterwaveData.mobileMoney?.phone?.trim()) errors['mobileMoney.phone'] = 'Wallet phone number is required';
    }
  }

  if (paymentMethod === 'BANK_TRANSFER') {
    const transferData = paymentData as DirectBankTransferPaymentData;
    if (!transferData.senderName.trim()) errors.senderName = 'Sender name is required';
    if (!transferData.senderPhone.trim()) errors.senderPhone = 'Sender phone is required';
    if (!transferData.senderBankName.trim()) errors.senderBankName = 'Sender bank is required';
    if (!transferData.transferPurpose.trim()) errors.transferPurpose = 'Tell us what this transfer is for';
  }

  return errors;
}

export function buildContactInfo(paymentData: PaymentData, shippingAddress: ShippingAddress): Record<string, any> {
  const billingAddress = resolveBillingAddress(paymentData, shippingAddress);

  const base = {
    phone: paymentData.phone,
    email: paymentData.email,
    billingSameAsShipping: paymentData.billingSameAsShipping,
    billingAddress,
    channel: paymentData.channel,
  };

  if (paymentData.method === 'BANK_TRANSFER') {
    return {
      ...base,
      senderName: paymentData.senderName,
      senderPhone: paymentData.senderPhone,
      senderBankName: paymentData.senderBankName,
      transferPurpose: paymentData.transferPurpose,
    };
  }

  if (paymentData.method === 'FLUTTERWAVE') {
    return {
      ...base,
      bankAccount: paymentData.bankAccount,
      ussd: paymentData.ussd,
      mobileMoney: paymentData.mobileMoney,
    };
  }

  return base;
}

export function buildPaymentSubmissionData(paymentData: PaymentData, shippingAddress: ShippingAddress): PaymentData {
  if (paymentData.method === 'PAYSTACK') {
    return {
      method: paymentData.method,
      channel: paymentData.channel,
      email: paymentData.email,
      phone: paymentData.phone,
      billingSameAsShipping: paymentData.billingSameAsShipping,
      billingAddress: resolveBillingAddress(paymentData, shippingAddress),
      consentAccepted: paymentData.consentAccepted,
    } as PaymentData;
  }

  return {
    ...paymentData,
    billingAddress: resolveBillingAddress(paymentData, shippingAddress),
  } as PaymentData;
}

export function getPaymentSummaryLines(
  paymentMethod: CheckoutPaymentMethod,
  paymentData: PaymentData,
): string[] {
  const lines = [paymentData.email, paymentData.phone];

  if (paymentMethod === 'PAYSTACK') {
    const paystackData = paymentData as PaystackPaymentData;
    lines.push('Hosted card checkout via Paystack');
    if (paystackData.channel === 'BANK_TRANSFER') {
      lines[lines.length - 1] = 'Hosted bank transfer checkout via Paystack';
      lines.push('Paystack will show the account details after redirect');
    }
  }

  if (paymentMethod === 'FLUTTERWAVE') {
    const flutterwaveData = paymentData as FlutterwavePaymentData;
    lines.push(`Flutterwave ${formatChannelLabel(flutterwaveData.channel)}`);
    if (flutterwaveData.channel === 'BANK_ACCOUNT' && flutterwaveData.bankAccount?.bankName) {
      lines.push(`${flutterwaveData.bankAccount.bankName} • ${flutterwaveData.bankAccount.accountNumber}`);
    }
    if (flutterwaveData.channel === 'USSD' && flutterwaveData.ussd?.bankName) {
      lines.push(`USSD bank: ${flutterwaveData.ussd.bankName}`);
    }
    if (flutterwaveData.channel === 'MOBILE_MONEY' && flutterwaveData.mobileMoney?.networkName) {
      lines.push(`${flutterwaveData.mobileMoney.networkName} • ${flutterwaveData.mobileMoney.phone}`);
    }
  }

  if (paymentMethod === 'BANK_TRANSFER') {
    const bankTransferData = paymentData as DirectBankTransferPaymentData;
    lines.push(`Sender: ${bankTransferData.senderName}`);
    lines.push(`Sending bank: ${bankTransferData.senderBankName}`);
    lines.push(bankTransferData.transferPurpose);
  }

  return lines.filter(Boolean);
}

export function getReviewCtaLabel(paymentMethod: CheckoutPaymentMethod, paymentData: PaymentData): string {
  if (paymentMethod === 'PAYSTACK') {
    return 'Continue to Paystack';
  }

  if (paymentMethod === 'BANK_TRANSFER') {
    return 'Generate Transfer Instructions';
  }

  if (paymentMethod === 'FLUTTERWAVE') {
    const flutterwaveData = paymentData as FlutterwavePaymentData;
    if (flutterwaveData.channel === 'USSD') return 'Generate USSD Instructions';
    if (flutterwaveData.channel === 'MOBILE_MONEY') return 'Start Mobile Money Payment';
    if (flutterwaveData.channel === 'BANK_ACCOUNT') return 'Start Bank Account Authorization';
  }

  return 'Continue to Secure Payment';
}

export function formatChannelLabel(channel: FlutterwavePaymentChannel | 'CARD' | 'BANK_TRANSFER'): string {
  switch (channel) {
    case 'CARD':
      return 'Card';
    case 'BANK_TRANSFER':
      return 'Bank Transfer';
    case 'BANK_ACCOUNT':
      return 'Bank Account';
    case 'USSD':
      return 'USSD';
    case 'MOBILE_MONEY':
      return 'Mobile Money';
    default:
      return channel;
  }
}
