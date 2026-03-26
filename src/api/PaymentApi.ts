import { apiClient } from './httpClient';
import type { CheckoutPaymentMethod, PaymentData, PaymentMethodType } from './StoreApi';

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
}

export interface PaymentNextAction {
  type:
    | 'REDIRECT'
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
  authorizationUrl?: string;
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
}

export interface PaymentAttemptSummary {
  paymentAttemptId: string;
  reference: string;
  gateway: string;
  providerMode: 'mock' | 'live';
  paymentMethod: CheckoutPaymentMethod;
  status: PaymentAttemptStatus;
  currency: string;
  settlementCurrency: string;
  settlementAmount: number;
  exchangeRateSnapshotId?: string;
  channel?: string;
  authorizationUrl?: string;
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

function extract<T>(res: any): T {
  return res?.data?.data ?? res?.data ?? res;
}

export const paymentApi = {
  async initialize(req: PaymentInitRequest): Promise<PaymentInitResult> {
    const res = await apiClient.post('/payment/initialize', req);
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

  async simulate(reference: string, outcome: PaymentAttemptStatus): Promise<PaymentAttemptSummary> {
    const res = await apiClient.post(`/payment/mock/${reference}/simulate`, { outcome });
    return extract<PaymentAttemptSummary>(res);
  },
};
