import { useCallback, useEffect, useMemo, useRef } from 'react';
import { marketApi, type MarketSignalEvent } from '@/api/MarketApi';

const ANONYMOUS_SESSION_STORAGE_KEY = 'threadly.market.anonymousSessionId.v1';
const MARKET_SIGNAL_QUEUE_LIMIT = 100;
const MARKET_SIGNAL_BATCH_LIMIT = 25;
const MARKET_SIGNAL_FLUSH_INTERVAL_MS = 5000;
const MARKET_SIGNAL_DUPLICATE_WINDOW_MS = 30_000;

const createClientId = (prefix: string) => {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
};

const getAnonymousSessionId = () => {
  if (typeof window === 'undefined') return createClientId('anon');

  try {
    const existing = window.localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = createClientId('anon');
    window.localStorage.setItem(ANONYMOUS_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return createClientId('anon');
  }
};

const isNoisySignal = (event: MarketSignalEvent) => {
  return (
    event.signalType === 'IMPRESSION' ||
    event.signalType === 'VIEW' ||
    event.signalType === 'MARKET_SECTION_VIEW' ||
    event.signalType === 'SUGGESTION_ITEM_VIEW'
  );
};

export const useMarketSignals = (screenContext: string) => {
  const anonymousSessionId = useMemo(() => getAnonymousSessionId(), []);
  const sessionId = useMemo(() => createClientId('market_session'), []);
  const queueRef = useRef<MarketSignalEvent[]>([]);
  const recentKeysRef = useRef<Map<string, number>>(new Map());
  const isFlushingRef = useRef(false);

  const trimRecentKeys = useCallback(() => {
    if (recentKeysRef.current.size <= MARKET_SIGNAL_QUEUE_LIMIT * 2) return;
    const now = Date.now();
    for (const [key, seenAt] of recentKeysRef.current.entries()) {
      if (now - seenAt > MARKET_SIGNAL_DUPLICATE_WINDOW_MS) {
        recentKeysRef.current.delete(key);
      }
    }
  }, []);

  const trackMarketSignal = useCallback(
    (event: MarketSignalEvent) => {
      if (!event.targetId || !event.targetType || !event.signalType) return;

      const normalized: MarketSignalEvent = {
        ...event,
        clientEventId: event.clientEventId ?? createClientId('market_signal_event'),
        screenContext: event.screenContext ?? screenContext,
        sessionId: event.sessionId ?? sessionId,
      };

      if (isNoisySignal(normalized)) {
        const key = [
          normalized.signalType,
          normalized.targetType,
          normalized.targetId,
          normalized.sectionKey ?? '',
          normalized.position ?? '',
        ].join(':');
        const now = Date.now();
        const lastSeenAt = recentKeysRef.current.get(key);
        if (lastSeenAt && now - lastSeenAt < MARKET_SIGNAL_DUPLICATE_WINDOW_MS) {
          return;
        }
        recentKeysRef.current.set(key, now);
        trimRecentKeys();
      }

      if (queueRef.current.length >= MARKET_SIGNAL_QUEUE_LIMIT) {
        queueRef.current.shift();
      }
      queueRef.current.push(normalized);
    },
    [screenContext, sessionId, trimRecentKeys],
  );

  const flushMarketSignals = useCallback(async () => {
    if (isFlushingRef.current || queueRef.current.length === 0) return;
    isFlushingRef.current = true;

    const batch = queueRef.current.splice(0, MARKET_SIGNAL_BATCH_LIMIT);
    try {
      await marketApi.sendMarketSignalBatch({
        batchId: createClientId('market_signal_batch'),
        anonymousSessionId,
        sessionId,
        events: batch,
      });
    } catch {
      queueRef.current = [...batch, ...queueRef.current].slice(
        0,
        MARKET_SIGNAL_QUEUE_LIMIT,
      );
    } finally {
      isFlushingRef.current = false;
    }
  }, [anonymousSessionId, sessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void flushMarketSignals();
    }, MARKET_SIGNAL_FLUSH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushMarketSignals();
      }
    };
    const handlePageHide = () => {
      void flushMarketSignals();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void flushMarketSignals();
    };
  }, [flushMarketSignals]);

  return {
    anonymousSessionId,
    flushMarketSignals,
    trackMarketSignal,
  };
};
