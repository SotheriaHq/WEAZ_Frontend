import type { QueuePresenter } from '@/api/CustomOrderQueueApi';

const receivedAt = new Map<string, number>();
const snapshotKey = (queue: Pick<QueuePresenter, 'serverNow' | 'orderRevision' | 'queueExpiresAt'>) =>
  `${queue.serverNow}|${queue.orderRevision}|${queue.queueExpiresAt ?? ''}`;

/** Anchor each server snapshot when received, never when a cached card mounts. */
export function registerQueuePayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const value = payload as Record<string, unknown>;
  if ('lane' in value && typeof value.serverNow === 'string') {
    const key = snapshotKey(payload as unknown as QueuePresenter);
    if (!receivedAt.has(key)) receivedAt.set(key, performance.now());
    if (receivedAt.size > 5000) receivedAt.delete(receivedAt.keys().next().value!);
  }
  if (value.queue) registerQueuePayload(value.queue);
  if (Array.isArray(value.items)) value.items.forEach(registerQueuePayload);
  if (value.orders && typeof value.orders === 'object') Object.values(value.orders).forEach(registerQueuePayload);
  return payload;
}

export function queueServerNow(queue: QueuePresenter, monotonicNow: number): number | null {
  const received = receivedAt.get(snapshotKey(queue));
  const server = Date.parse(queue.serverNow);
  if (received == null || !Number.isFinite(server)) return null;
  return server + Math.max(0, monotonicNow - received);
}
