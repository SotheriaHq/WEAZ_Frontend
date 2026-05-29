import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMarketSignalBatchMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/MarketApi', () => ({
  marketApi: {
    sendMarketSignalBatch: sendMarketSignalBatchMock,
  },
}));

import {
  __webMarketSignalQueueTestUtils,
  clearWebMarketSignalQueue,
  enqueueWebMarketSignal,
  flushWebMarketSignals,
  WEB_MARKET_SIGNAL_BATCH_LIMIT,
  WEB_MARKET_SIGNAL_QUEUE_LIMIT,
  WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY,
  WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY,
} from './marketSignalQueue';

const baseSignal = (targetId: string, overrides: Record<string, unknown> = {}) => ({
  targetType: 'PRODUCT' as const,
  targetId,
  signalType: 'CLICK' as const,
  surface: 'MARKET_HOME' as const,
  ...overrides,
});

const options = { screenContext: 'MARKET_HOME', sessionId: 'market_session_1' };

describe('marketSignalQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    sendMarketSignalBatchMock.mockReset();
    __webMarketSignalQueueTestUtils.reset();
  });

  it('caps persisted signal queue size', () => {
    for (let index = 0; index < WEB_MARKET_SIGNAL_QUEUE_LIMIT + 5; index += 1) {
      enqueueWebMarketSignal(baseSignal(`product_${index}`), options);
    }

    const snapshot = __webMarketSignalQueueTestUtils.getQueueSnapshot();
    expect(snapshot).toHaveLength(WEB_MARKET_SIGNAL_QUEUE_LIMIT);
    expect(snapshot[0]?.event.targetId).toBe('product_5');
    expect(JSON.parse(localStorage.getItem(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY) ?? '[]')).toHaveLength(
      WEB_MARKET_SIGNAL_QUEUE_LIMIT,
    );
  });

  it('dedupes duplicate noisy impressions for the same item window', () => {
    const impression = baseSignal('product_1', { signalType: 'IMPRESSION' });

    expect(enqueueWebMarketSignal(impression, options)).toBe(true);
    expect(enqueueWebMarketSignal(impression, options)).toBe(false);

    expect(__webMarketSignalQueueTestUtils.getQueueSnapshot()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('flushes canonical batches without exceeding the batch limit', async () => {
    sendMarketSignalBatchMock.mockResolvedValueOnce({ accepted: true });
    for (let index = 0; index < WEB_MARKET_SIGNAL_BATCH_LIMIT + 3; index += 1) {
      enqueueWebMarketSignal(baseSignal(`product_${index}`), options);
    }

    await flushWebMarketSignals({ anonymousSessionId: 'anon_1', sessionId: 'market_session_1' });

    expect(sendMarketSignalBatchMock).toHaveBeenCalledTimes(1);
    const payload = sendMarketSignalBatchMock.mock.calls[0][0];
    expect(payload.anonymousSessionId).toBe('anon_1');
    expect(payload.events).toHaveLength(WEB_MARKET_SIGNAL_BATCH_LIMIT);
    expect(payload.events[0]).toEqual(
      expect.objectContaining({
        clientEventId: expect.stringMatching(/^market_signal_event_/),
        screenContext: 'MARKET_HOME',
        sessionId: 'market_session_1',
      }),
    );
    expect(__webMarketSignalQueueTestUtils.getQueueSnapshot()).toHaveLength(3);
  });

  it('retries failed flushes with bounded backoff instead of immediate loops', async () => {
    sendMarketSignalBatchMock.mockRejectedValueOnce(new Error('network down'));
    enqueueWebMarketSignal(baseSignal('product_1'), options);

    await flushWebMarketSignals({ anonymousSessionId: 'anon_1', sessionId: 'market_session_1' });
    await flushWebMarketSignals({ anonymousSessionId: 'anon_1', sessionId: 'market_session_1' });

    const retry = __webMarketSignalQueueTestUtils.getQueueSnapshot()[0];
    expect(sendMarketSignalBatchMock).toHaveBeenCalledTimes(1);
    expect(retry?.retryCount).toBe(1);
    expect(retry?.nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it('clears queued and recent signal state during logout cleanup', () => {
    enqueueWebMarketSignal(baseSignal('product_1', { signalType: 'IMPRESSION' }), options);

    clearWebMarketSignalQueue();

    expect(__webMarketSignalQueueTestUtils.getQueueSnapshot()).toHaveLength(0);
    expect(localStorage.getItem(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY)).toBeNull();
  });
});
