import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { createIdempotencyKey } from './idempotency';
import type { QueueTier } from './CustomOrderQueueApi';

export interface BrandQueueSubscription {
  tierKey: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lockedMonthlyPriceNgn: number;
  cancelAtPeriodEnd: boolean;
  pendingTierKey?: string | null;
  recoveryUntil?: string | null;
}
export interface BrandSubscriptionInvoice { id: string; amountNgn: number; status: string; createdAt: string; paidAt?: string | null; reference?: string | null; authorizationUrl?: string | null }
export interface SubscriptionPreview { amountNgn: number; effectiveAt: string; kind: string; periodEnd: string }
export interface SubscriptionCheckout { reference?: string; authorizationUrl?: string; providerAccessCode?: string; amountNgn: number; effectiveAt: string; action: string; status?: string }
const path = (id: string) => `/brands/${id}/subscription`;
async function post<T>(url: string, payload: unknown) {
  const key = createIdempotencyKey();
  return unwrapApiResponse<T>((await apiClient.post(url, payload, { headers: { 'Idempotency-Key': key } })).data);
}
export const brandSubscriptionApi = {
  get: async (id: string) => unwrapApiResponse<{ subscription: BrandQueueSubscription | null; assignedTierKey?: string | null; legacyEligible?: boolean; tiers: QueueTier[]; invoices: BrandSubscriptionInvoice[]; compensations?: Array<{reference: string; amountNgn: number; currency: string; status: string; reason?: string; refundedAt?: string | null; lastError?: string | null}>; serverNow: string }>((await apiClient.get(path(id))).data),
  preview: (id: string, tierKey: string) => post<SubscriptionPreview>(`${path(id)}/preview`, { tierKey }),
  checkout: (id: string, tierKey: string, callbackUrl: string, expectedAmountNgn: number) => post<SubscriptionCheckout>(`${path(id)}/checkout`, { tierKey, callbackUrl, expectedAmountNgn, recurringConsent: true, legalVersion: '2026.10.18-v1.3' }),
  cancelRenewal: (id: string) => post<unknown>(`${path(id)}/cancel-renewal`, {}),
  verify: (id: string, reference: string) => post<{ status: string; subscription?: BrandQueueSubscription }>(`${path(id)}/verify`, { reference }),
};
