import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './httpClient';
import { adminOrderQueueApi, customOrderQueueApi } from './CustomOrderQueueApi';
import { brandSubscriptionApi } from './BrandSubscriptionApi';
import { queueServerNow } from '@/features/orders/queueClock';
import { LEGAL_PAGE_VERSION } from '@/pages/legal/legalVersion';

vi.mock('./httpClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const queue = { lane: 'PENDING', orderRevision: 4, serverNow: '2026-10-18T12:00:00Z', queueExpiresAt: '2026-11-18T12:00:00Z' };
beforeEach(() => vi.resetAllMocks());
describe('queue API contracts', () => {
  it('unwraps the nested mutation queue and sends server revision and idempotency', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { queue } } });
    const result = await customOrderQueueApi.retain('order-a', 4);
    expect(result).toEqual(queue);
    expect(apiClient.post).toHaveBeenCalledWith('/custom-orders/queue/orders/order-a/retain', { expectedRevision: 4 }, { headers: { 'Idempotency-Key': expect.any(String) } });
    expect(queueServerNow(result, performance.now())).not.toBeNull();
  });
  it('uses the authorized admin quote and mutation paths', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { orderRevision: 4, refundAmount: 113000 } } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { queue } } });
    await adminOrderQueueApi.refundQuote('order-a');
    const result = await adminOrderQueueApi.action('order-a', 'cancel', 'Owner approved cancellation', 4);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/custom-order-queue/orders/order-a/refund-quote');
    expect(result).toEqual(queue);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/custom-order-queue/orders/order-a/cancel', { reason: 'Owner approved cancellation', expectedRevision: 4 }, expect.any(Object));
  });
  it('submits explicit recurring consent, accepted policy and the exact held quote', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { action: 'PAYMENT_REQUIRED', reference: 'sub-a', amountNgn: 10000 } } });
    const quote = { quoteId: '11111111-1111-4111-8111-111111111111', brandId: 'brand-a', amountNgn: 10000,
      effectiveAt: '', periodEnd: '', kind: 'INITIAL', expiresAt: '', serverNow: '', validUntilMonotonicMs: performance.now() + 300000 };
    const result = await brandSubscriptionApi.checkout('brand-a', 'THREAD', 'https://wiez.com/settings?tab=subscription-billing', quote);
    expect(result.reference).toBe('sub-a');
    expect(apiClient.post).toHaveBeenCalledWith('/brands/brand-a/subscription/checkout', { quoteId: quote.quoteId, tierKey: 'THREAD', callbackUrl: 'https://wiez.com/settings?tab=subscription-billing', expectedAmountNgn: 10000, recurringConsent: true, legalVersion: LEGAL_PAGE_VERSION }, expect.any(Object));
  });
  it('does not send checkout when the held quote expired or belongs to another brand', async () => {
    const quote = { quoteId: '11111111-1111-4111-8111-111111111111', brandId: 'brand-a', amountNgn: 10000,
      effectiveAt: '', periodEnd: '', kind: 'INITIAL', expiresAt: '', serverNow: '', validUntilMonotonicMs: performance.now() - 1 };
    await expect(brandSubscriptionApi.checkout('brand-a', 'THREAD', 'https://wiez.com', quote)).rejects.toThrow('fresh price');
    await expect(brandSubscriptionApi.checkout('brand-b', 'THREAD', 'https://wiez.com', { ...quote, validUntilMonotonicMs: performance.now() + 300000 })).rejects.toThrow('fresh price');
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('does not turn a failed capture or refund request into a successful queue state', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('No provider response'));
    await expect(customOrderQueueApi.cancel('order-a', 'Changed plans', 4)).rejects.toThrow('No provider response');
  });
});
