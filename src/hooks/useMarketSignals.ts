import { useCallback, useEffect, useMemo } from 'react';

import type { MarketSignalEvent } from '@/api/MarketApi';
import {
  createWebMarketSignalClientId,
  enqueueWebMarketSignal,
  flushWebMarketSignals as flushQueuedWebMarketSignals,
  getWebMarketSignalAnonymousSessionId,
  WEB_MARKET_SIGNAL_FLUSH_INTERVAL_MS,
} from '@/services/marketSignalQueue';

export const useMarketSignals = (screenContext: string) => {
  const anonymousSessionId = useMemo(
    () => getWebMarketSignalAnonymousSessionId(),
    [],
  );
  const sessionId = useMemo(
    () => createWebMarketSignalClientId('market_session'),
    [],
  );

  const trackMarketSignal = useCallback(
    (event: MarketSignalEvent) =>
      enqueueWebMarketSignal(event, { screenContext, sessionId }),
    [screenContext, sessionId],
  );

  const flushMarketSignals = useCallback(
    () => flushQueuedWebMarketSignals({ anonymousSessionId, sessionId }),
    [anonymousSessionId, sessionId],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      void flushMarketSignals();
    }, WEB_MARKET_SIGNAL_FLUSH_INTERVAL_MS);

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
