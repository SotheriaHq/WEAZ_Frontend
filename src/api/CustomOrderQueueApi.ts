import { registerQueuePayload } from '@/features/orders/queueClock';
import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { createIdempotencyKey } from './idempotency';

export type QueueLane = 'PENDING' | 'UP_NEXT' | 'ACTIVE' | 'IN_DELIVERY' | 'TERMINAL' | 'COMPLETED' | 'CANCELLED' | 'NONE' | null;
export interface QueuePresenter {
  refundHistory?: Array<{ id: string; kind: string; status: string; amount: number; currency: string; createdAt: string }>;
  lane: QueueLane;
  orderRevision: number;
  queueExpiresAt: string | null;
  serverNow: string;
  retainOpensAt: string | null;
  retainClosesAt: string | null;
  canRetain: boolean;
  canCancel: boolean;
  canResubmit: boolean;
  adminPromotionHeld: boolean;
  position: number | null;
  waitingCount: number;
  activatedAt?: string | null;
  captureSummary?: { held?: boolean; amount?: number; heldAmount?: number; currency?: string; status?: string } | null;
  refundSummary?: { kind?: string; amount?: number; currency?: string; status?: string; settlement?: { status?: string; amount?: number; currency?: string } | null } | null;
}
export interface QueueBrandSummary {
  brandId: string;
  counts: Record<'PENDING' | 'UP_NEXT' | 'ACTIVE' | 'IN_DELIVERY', number>;
  capacity: { tierKey: string; active: number | null; inDelivery: number | null; queueJumpAllowed: boolean };
  queueJumpEnabled: boolean;
  intakeBlocked: boolean;
  intakeAllowed: boolean;
  jumpAvailable: boolean;
  massCancelAttentionAt?: string | null;
  activeOrderCapOverride?: number | null;
  activeOrderCapOverrideUntil?: string | null;
  openOrderCount: number;
  buyerOpenOrderCount?: number;
  serverNow: string;
}
export interface QueueRefundQuote {
  settlement?: { status: 'RECORDED' | 'REQUIRES_RECONCILIATION'; amount?: number; currency?: string; rate?: string };
  settlementIsEstimate?: boolean;
  orderRevision: number;
  currency: string;
  capturedAmount?: number;
  garmentSubtotal?: number;
  vatWithheld?: number;
  garmentFeeWithheld?: number;
  jumpFeeWithheld?: number;
  deliveryRefund?: number;
  refundAmount: number;
  totalWithheld?: number;
}
export interface QueueTier {
  tierKey: string;
  label?: string;
  monthlyPriceNgn: number;
  updatedAt?: string;
  maxActive: number | null;
  maxInDelivery: number | null;
  queueJumpAllowed: boolean;
}
export interface QueueCampaign {
  id: string;
  deltaActive: number;
  startsAt: string;
  endsAt: string;
  resetMode: 'AUTOMATIC' | 'MANUAL';
  note?: string;
  resetAt?: string | null;
}
export interface QueueNotice {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  kind: 'BONUS' | 'FREE_ORDER_PERIOD' | 'GENERAL';
  published: boolean;
  endedAt?: string | null;
  publishedAt?: string | null;
}
const root = '/custom-orders/queue';
const admin = '/admin/custom-order-queue';
async function get<T>(path: string) { return registerQueuePayload(unwrapApiResponse<T>((await apiClient.get(path)).data)); }
async function post<T>(path: string, payload: unknown) {
  const key = createIdempotencyKey();
  return registerQueuePayload(unwrapApiResponse<T>((await apiClient.post(path, payload, { headers: { 'Idempotency-Key': key } })).data));
}
async function patch<T>(path: string, payload: unknown) { return unwrapApiResponse<T>((await apiClient.patch(path, payload)).data); }
export const customOrderQueueApi = {
  brand: (id: string) => get<QueueBrandSummary>(`${root}/brands/${id}`),
  summaries: (orderIds: string[]) => post<{ orders: Record<string, QueuePresenter>; serverNow: string }>(`${root}/summaries`, { orderIds }),
  order: (id: string) => get<QueuePresenter>(`${root}/orders/${id}`),
  refundQuote: (id: string) => get<QueueRefundQuote>(`${root}/orders/${id}/refund-quote`),
  retain: async (id: string, expectedRevision: number) => (await post<{ queue: QueuePresenter }>(`${root}/orders/${id}/retain`, { expectedRevision })).queue,
  cancel: async (id: string, reason: string, expectedRevision: number) => (await post<{ queue: QueuePresenter }>(`${root}/orders/${id}/cancel`, { reason, expectedRevision })).queue,
  resubmit: (id: string) => post<{ sourceType: string; sourceId: string; configurationId: string; previousOrderId: string; refundPending: boolean; requiresNewPayment: true }>(`${root}/orders/${id}/resubmit`, {}),
  cancelMany: (brandId: string, orderIds: string[], reason: string) => post<{ results: Array<{ id: string; cancelled: boolean; message?: string }> }>(`${root}/brands/${brandId}/cancel-many`, { orderIds, reason }),
  settings: (id: string, queueJumpEnabled: boolean) => patch<QueueBrandSummary>(`${root}/brands/${id}/settings`, { queueJumpEnabled }),
  notices: () => get<{ notices: QueueNotice[]; serverNow: string }>(`${root}/notices`),
};
export const adminOrderQueueApi = {
  brand: (id: string) => get<QueueBrandSummary>(`${admin}/brands/${id}`),
  intake: (id: string, blocked: boolean, reason: string) => patch<QueueBrandSummary>(`${admin}/brands/${id}/intake`, { blocked, reason }),
  refundQuote: (id: string) => get<QueueRefundQuote>(`${admin}/orders/${id}/refund-quote`),
  action: async (id: string, action: 'promote' | 'demote' | 'release-hold' | 'cancel', reason: string, expectedRevision?: number) => (await post<{ queue: QueuePresenter }>(`${admin}/orders/${id}/${action}`, { reason, ...(expectedRevision == null ? {} : { expectedRevision }) })).queue,
  assignTier: (id: string, tierKey: string, reason: string) => post<QueueBrandSummary>(`${admin}/brands/${id}/assign-tier`, { tierKey, reason }),
  tiers: () => get<{ tiers: QueueTier[] } | QueueTier[]>(`${admin}/tiers`),
  updateTier: (key: string, payload: { maxActive?: number; maxInDelivery?: number; monthlyPriceNgn?: number; expectedUpdatedAt?: string }) => patch<QueueTier>(`${admin}/tiers/${key}`, payload),
  campaigns: () => get<{ campaigns: QueueCampaign[] } | QueueCampaign[]>(`${admin}/campaigns`),
  campaign: (payload: Omit<QueueCampaign, 'id' | 'status'>) => post<QueueCampaign>(`${admin}/campaigns`, payload),
  resetCampaign: (id: string) => post<QueueCampaign>(`${admin}/campaigns/${id}/reset`, {}),
  override: (id: string, activeCap: number | null, expiresAt?: string, reason?: string) => patch<QueueBrandSummary>(`${admin}/brands/${id}/override`, { activeCap, expiresAt, reason }),
  notices: async () => { const result = await get<{ notices: QueueNotice[] }>(`${admin}/notices`); return { notices: result.notices.map((notice) => ({ ...notice, published: Boolean(notice.publishedAt) })) }; },
  notice: (payload: Omit<QueueNotice, 'id' | 'status'>) => post<QueueNotice>(`${admin}/notices`, payload),
  publishNotice: (id: string, published: boolean) => patch<QueueNotice>(`${admin}/notices/${id}`, { published }),
  endNotice: (id: string) => post<QueueNotice>(`${admin}/notices/${id}/end`, {}),
};
