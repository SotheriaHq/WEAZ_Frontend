import { LEGAL_PAGE_VERSION } from '@/pages/legal/legalDocuments';
import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { createIdempotencyKey } from './idempotency';
import type { QueueTier } from './CustomOrderQueueApi';

export interface BrandQueueSubscription {
  id?: string;
  savedPaymentMethodId?: string | null;
  tierKey: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lockedMonthlyPriceNgn: number;
  cancelAtPeriodEnd: boolean;
  pendingTierKey?: string | null;
  recoveryUntil?: string | null;
}
export interface BrandSubscriptionInvoice {
  id: string;
  amountNgn: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  reference?: string | null;
  authorizationUrl?: string | null;
}
export interface SubscriptionPreview {
  amountNgn: number;
  effectiveAt: string;
  kind: string;
  periodEnd: string;
}
export interface SubscriptionCheckout {
  reference?: string;
  authorizationUrl?: string;
  providerAccessCode?: string;
  amountNgn: number;
  effectiveAt: string;
  action: string;
  status?: string;
}
export interface SubscriptionHistoryItem
  extends Partial<BrandQueueSubscription> {
  id: string;
  createdAt: string;
  amountNgn?: number;
  currency?: string;
  reference?: string;
  periodStart?: string;
  periodEnd?: string;
  purpose?: string;
  cancelRequestedAt?: string | null;
}
const path = (id: string) => `/brands/${id}/subscription`;
async function post<T>(url: string, payload: unknown) {
  const key = createIdempotencyKey();
  return unwrapApiResponse<T>(
    (
      await apiClient.post(url, payload, {
        headers: { 'Idempotency-Key': key },
      })
    ).data,
  );
}
export const brandSubscriptionApi = {
  history: async (
    id: string,
    kind: 'BILLING' | 'SUBSCRIPTIONS',
    cursor?: string,
  ) =>
    unwrapApiResponse<{
      items: SubscriptionHistoryItem[];
      nextCursor: string | null;
    }>(
      (await apiClient.get(`${path(id)}/history`, { params: { kind, cursor } }))
        .data,
    ),
  get: async (id: string) =>
    unwrapApiResponse<{
      subscription: BrandQueueSubscription | null;
      assignedTierKey?: string | null;
      tiers: QueueTier[];
      invoices: BrandSubscriptionInvoice[];
      compensations?: Array<{
        reference: string;
        amountNgn: number;
        currency: string;
        status: string;
        reason?: string;
        refundedAt?: string | null;
        lastError?: string | null;
      }>;
      serverNow: string;
    }>((await apiClient.get(path(id))).data),
  preview: (id: string, tierKey: string) =>
    post<SubscriptionPreview>(`${path(id)}/preview`, { tierKey }),
  checkout: (
    id: string,
    tierKey: string,
    callbackUrl: string,
    expectedAmountNgn: number,
    savedCardId?: string,
  ) =>
    post<SubscriptionCheckout>(`${path(id)}/checkout`, {
      tierKey,
      callbackUrl,
      expectedAmountNgn,
      savedCardId,
      recurringConsent: true,
      legalVersion: LEGAL_PAGE_VERSION,
    }),
  cards: async (id: string) =>
    unwrapApiResponse<import('./PaymentApi').SavedPaymentCardSummary[]>(
      (await apiClient.get(`${path(id)}/payment-methods`)).data,
    ),
  changeCard: (id: string, savedCardId: string) =>
    post<{ success: boolean }>(`${path(id)}/payment-method`, {
      savedCardId,
      recurringConsent: true,
      legalVersion: LEGAL_PAGE_VERSION,
    }),
  claimNotice: (id: string) =>
    post<{
      notice: {
        tierKey: string;
        title: string;
        message: string;
        targetUrl: string;
      } | null;
    }>(`${path(id)}/notice`, {}),
  dismissNotice: (id: string) =>
    post<{ success: boolean }>(`${path(id)}/notice/dismiss`, {}),
  cancelRenewal: (id: string) =>
    post<unknown>(`${path(id)}/cancel-renewal`, {}),
  verify: (id: string, reference: string) =>
    post<{ status: string; subscription?: BrandQueueSubscription }>(
      `${path(id)}/verify`,
      { reference },
    ),
};
