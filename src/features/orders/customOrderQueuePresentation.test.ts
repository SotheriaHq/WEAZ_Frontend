import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QueuePresenter } from '@/api/CustomOrderQueueApi';
import { canRetainQueue, formatQueueCountdown } from './customOrderQueuePresentation';
import { queueServerNow, registerQueuePayload } from './queueClock';

const now = Date.parse('2026-10-18T12:00:00Z');
const fixture = (overrides: Partial<QueuePresenter> = {}): QueuePresenter => ({ lane: 'PENDING', orderRevision: 1, serverNow: new Date(now).toISOString(), queueExpiresAt: new Date(now + 24 * 3600000).toISOString(), retainOpensAt: new Date(now - 24 * 3600000).toISOString(), retainClosesAt: new Date(now + 12 * 3600000).toISOString(), canRetain: true, canCancel: true, canResubmit: false, adminPromotionHeld: false, position: 3, waitingCount: 10, ...overrides });

afterEach(() => vi.restoreAllMocks());
describe('queue presentation boundaries', () => {
  it('shows cancellation due without claiming that local expiry cancelled the order', () => {
    expect(formatQueueCountdown(new Date(now).toISOString(), now)).toBe('Cancellation due - refreshing from WIEZ');
    expect(formatQueueCountdown(new Date(now - 1).toISOString(), now)).toBe('Cancellation due - refreshing from WIEZ');
    expect(formatQueueCountdown(null, now)).toBeNull();
    expect(formatQueueCountdown('invalid', now)).toBeNull();
  });
  it('switches between days and hours at the actual 48-hour boundary', () => {
    expect(formatQueueCountdown(new Date(now + 48 * 3600000).toISOString(), now)).toBe('Cancels in 2d 0h');
    expect(formatQueueCountdown(new Date(now + 48 * 3600000 - 1).toISOString(), now)).toBe('Cancels in 48h 0m');
    expect(formatQueueCountdown(new Date(now + 1).toISOString(), now)).toBe('Cancels in 0h 1m');
  });
  it('uses inclusive server-authorized retain windows and protects every other lane', () => {
    const order = fixture();
    const opens = Date.parse(order.retainOpensAt!);
    const closes = Date.parse(order.retainClosesAt!);
    expect(canRetainQueue(order, opens - 1)).toBe(false);
    expect(canRetainQueue(order, opens)).toBe(true);
    expect(canRetainQueue(order, closes)).toBe(true);
    expect(canRetainQueue(order, closes + 1)).toBe(false);
    expect(canRetainQueue({ ...order, canRetain: false }, now)).toBe(false);
    for (const lane of ['ACTIVE', 'IN_DELIVERY', 'TERMINAL', null] as const) expect(canRetainQueue({ ...order, lane }, now)).toBe(false);
  });
});
describe('server-anchored queue time', () => {
  it('survives structural sharing clones and card remounts without resetting expiry', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const order = registerQueuePayload(fixture({ orderRevision: 97001 }));
    expect(queueServerNow(order, 11000)).toBe(now + 10000);
    expect(queueServerNow(structuredClone(order), 31000)).toBe(now + 30000);
  });
  it('does not trust a device wall clock or an unregistered persisted snapshot', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000);
    vi.spyOn(Date, 'now').mockReturnValue(1);
    const order = registerQueuePayload({ queue: fixture({ orderRevision: 97002 }) }).queue;
    expect(queueServerNow(order, 5000)).toBe(now + 3000);
    expect(queueServerNow(fixture({ orderRevision: 97003 }), 5000)).toBeNull();
  });
});
