import { apiClient } from './httpClient';
import type { PaymentMethodType } from './StoreApi';

export interface PaymentInitRequest {
  orderIds: string[];
  paymentMethod: PaymentMethodType;
  email: string;
  callbackUrl?: string;
}

export interface PaymentInitResult {
  reference: string;
  gateway: string;
  authorizationUrl?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresAt: string;
  };
  directApproval?: boolean;
}

export interface PaymentVerifyResult {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  channel?: string;
  gatewayResponse?: string;
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
};
