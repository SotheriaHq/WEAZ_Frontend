import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';
import type { PaymentData, PaymentMethodType, ShippingAddress } from './StoreApi';

export type PaymentAttemptStatus =
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface PaymentInitRequest {
  orderIds: string[];
  paymentMethod: PaymentMethodType;
  email: string;
  callbackUrl?: string;
  paymentData?: PaymentData;
  idempotencyKey?: string;
  validationSessionId?: string;
}

export interface InitializeUnifiedCheckoutRequest {
  paymentMethod: PaymentMethodType;
  email: string;
  customerName: string;
  shippingAddress: ShippingAddress;
  contactInfo: Record<string, unknown>;
  callbackUrl?: string;
  paymentData?: PaymentData;
  idempotencyKey?: string;
  validationSessionId?: string;
}

export interface CardValidationSessionSummary {
  sessionId: string;
  status: 'VALIDATED' | 'EXPIRED';
  gateway: 'PAYSTACK';
  channel: 'CARD';
  useSavedCard: boolean;
  savedPaymentMethodId?: string | null;
  savedCardId?: string | null;
  email: string;
  validatedAt: string;
  expiresAt: string;
  cardSummary: {
    source: 'saved' | 'new';
    brand: string | null;
    bank: string | null;
    last4: string;
    expMonth: string | null;
    expYear: string | null;
    holderName: string | null;
  };
}

export interface PaymentClientCheckoutPolicy {
  paystack: {
    customCardEntryEnabled: boolean;
    cardholderNameMatchMode: 'strict' | 'soft' | 'off';
    validationSessionRequired: boolean;
  };
  savedMethods: {
    canonicalEnabled: boolean;
  };
}

export interface PaymentNextAction {
  type:
    | 'REDIRECT'
    | 'INLINE_POPUP'
    | 'BANK_TRANSFER_INSTRUCTIONS'
    | 'USSD_INSTRUCTIONS'
    | 'MOBILE_MONEY_APPROVAL'
    | 'BANK_ACCOUNT_AUTH'
    | 'PENDING_CONFIRMATION';
  title: string;
  description: string;
  instructions: string[];
  ctaLabel?: string;
  expiresAt?: string;
  ussdCode?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  paymentAttemptId: string;
  reference: string;
  gateway: string;
  status: PaymentAttemptStatus;
  currency: string;
  settlementCurrency: string;
  settlementAmount: number;
  exchangeRateSnapshotId?: string;
  channel?: string;
  providerAccessCode?: string;
  callbackUrl?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresAt: string;
    amount?: number;
    narration?: string;
  };
  directApproval?: boolean;
  nextAction?: PaymentNextAction;
  checkoutSessionId?: string;
  summary?: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    shippingCost: number;
    discount: number;
    grandTotal: number;
    shippingName: string;
    shippingCity: string;
    shippingState: string;
  };
  blockedLines?: Array<{
    type: 'CUSTOM_ORDER';
    sessionId: string;
    checkoutIntentId: string;
    sourceTitle: string;
    reason: string;
  }>;
}

export interface PaymentVerifyResult {
  success: boolean;
  status: PaymentAttemptStatus;
  paymentAttemptId?: string;
  reference: string;
  amount: number;
  currency: string;
  settlementCurrency: string;
  settlementAmount: number;
  exchangeRateSnapshotId?: string;
  paidAt?: string;
  channel?: string;
  gatewayResponse?: string;
  failureMessage?: string;
  orderIds?: string[];
  customOrderIds?: string[];
  checkoutSessionId?: string;
  summary?: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    shippingCost: number;
    discount: number;
    grandTotal: number;
    shippingName: string;
    shippingCity: string;
    shippingState: string;
  };
}

export interface PaymentAttemptSummary {
  paymentAttemptId: string;
  reference: string;
  subjectType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'UNIFIED_CHECKOUT';
  customOrderId?: string;
  customOrderIds?: string[];
  checkoutIntentId?: string;
  checkoutSessionId?: string;
  gateway: string;
  providerMode: 'mock' | 'live';
  paymentMethod: PaymentMethodType;
  status: PaymentAttemptStatus;
  currency: string;
  settlementCurrency: string;
  settlementAmount: number;
  exchangeRateSnapshotId?: string;
  channel?: string;
  providerAccessCode?: string;
  callbackUrl?: string;
  bankAccount?: PaymentInitResult['bankAccount'];
  paymentData?: Record<string, any>;
  nextAction?: PaymentNextAction;
  canRetry: boolean;
  canSimulate: boolean;
  orderIds: string[];
  summary: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    shippingCost: number;
    discount: number;
    grandTotal: number;
    shippingName: string;
    shippingCity: string;
    shippingState: string;
  };
}

export interface SavedPaymentCardSummary {
  id: string;
  gateway: 'PAYSTACK';
  brand: string | null;
  bank: string | null;
  last4: string;
  expMonth: string | null;
  expYear: string | null;
  reusable: boolean;
  isDefault?: boolean;
  addedAt: string;
  lastUsedAt: string;
}

export interface SavedPaymentMethodMutationResult {
  success: boolean;
  method: SavedPaymentCardSummary;
}

function extract<T>(res: any): T {
  return res?.data?.data ?? res?.data ?? res;
}

export const paymentApi = {
  async initialize(req: PaymentInitRequest): Promise<PaymentInitResult> {
    const idempotencyKey = req.idempotencyKey ?? createIdempotencyKey();
    const res = await apiClient.post(
      '/payment/initialize',
      { ...req, idempotencyKey },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return extract<PaymentInitResult>(res);
  },

  async initializeUnified(req: InitializeUnifiedCheckoutRequest): Promise<PaymentInitResult> {
    const idempotencyKey = req.idempotencyKey ?? createIdempotencyKey();
    const res = await apiClient.post(
      '/payment/initialize-unified',
      { ...req, idempotencyKey },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return extract<PaymentInitResult>(res);
  },

  async verify(reference: string, gateway: string, otp?: string): Promise<PaymentVerifyResult> {
    const res = await apiClient.post('/payment/verify', { reference, gateway, otp });
    return extract<PaymentVerifyResult>(res);
  },

  async verifyWithStatus(reference: string, gateway: string, statusHint?: string): Promise<PaymentVerifyResult> {
    const res = await apiClient.post('/payment/verify', { reference, gateway, statusHint });
    return extract<PaymentVerifyResult>(res);
  },

  async getAttempt(reference: string): Promise<PaymentAttemptSummary> {
    const res = await apiClient.get(`/payment/attempts/${reference}`);
    return extract<PaymentAttemptSummary>(res);
  },

  async getAttemptByOrder(orderId: string): Promise<PaymentAttemptSummary> {
    const res = await apiClient.get(`/payment/attempts/by-order/${orderId}`);
    return extract<PaymentAttemptSummary>(res);
  },

  async listSavedCards(): Promise<SavedPaymentCardSummary[]> {
    const res = await apiClient.get('/payment/saved-cards');
    return extract<SavedPaymentCardSummary[]>(res) ?? [];
  },

  async removeSavedCard(savedCardId: string): Promise<SavedPaymentMethodMutationResult> {
    const res = await apiClient.delete(
      `/payment/saved-cards/${encodeURIComponent(savedCardId)}`,
    );
    return extract<SavedPaymentMethodMutationResult>(res);
  },

  async setDefaultSavedCard(savedCardId: string): Promise<SavedPaymentMethodMutationResult> {
    const res = await apiClient.post(
      `/payment/saved-cards/${encodeURIComponent(savedCardId)}/default`,
    );
    return extract<SavedPaymentMethodMutationResult>(res);
  },

  async validateCard(req: {
    paymentMethod: PaymentMethodType;
    paymentData: PaymentData;
  }): Promise<CardValidationSessionSummary> {
    const idempotencyKey = createIdempotencyKey();
    const res = await apiClient.post('/payment/cards/validate', req, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return extract<CardValidationSessionSummary>(res);
  },

  async getCardValidationSession(sessionId: string): Promise<CardValidationSessionSummary> {
    const res = await apiClient.get(`/payment/cards/validate/${encodeURIComponent(sessionId)}`);
    return extract<CardValidationSessionSummary>(res);
  },

  async getPolicy(): Promise<PaymentClientCheckoutPolicy> {
    const res = await apiClient.get('/payment/policy');
    return extract<PaymentClientCheckoutPolicy>(res);
  },

  async simulate(reference: string, outcome: PaymentAttemptStatus): Promise<PaymentAttemptSummary> {
    const res = await apiClient.post(`/payment/mock/${reference}/simulate`, { outcome });
    return extract<PaymentAttemptSummary>(res);
  },
};
