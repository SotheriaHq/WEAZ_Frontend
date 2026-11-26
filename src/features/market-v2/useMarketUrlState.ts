import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseMarketUrlState,
  serializeMarketUrlState,
  type MarketUrlState,
} from './marketFilterState';

export interface MarketUrlStateApi extends MarketUrlState {
  /**
   * Write a new state. A shopper's choice is a new history entry, so Back
   * walks through their filter changes; corrections the page makes on its own
   * replace the entry instead.
   */
  readonly commit: (next: MarketUrlState, options?: { replace?: boolean }) => void;
  /** Some Market parameters in the opened link could not be used. */
  readonly linkCorrected: boolean;
  readonly dismissLinkCorrection: () => void;
}

export function useMarketUrlState(): MarketUrlStateApi {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = useMemo(() => parseMarketUrlState(searchParams), [searchParams]);
  const [linkCorrected, setLinkCorrected] = useState(false);

  const commit = useCallback(
    (next: MarketUrlState, options?: { replace?: boolean }) => {
      setSearchParams((previous) => serializeMarketUrlState(next, previous), {
        replace: options?.replace ?? false,
        preventScrollReset: true,
      });
    },
    [setSearchParams],
  );

  const { filters, sort, dropped } = parsed;
  useEffect(() => {
    if (!dropped) return;
    // Rewrite the address to what is actually applied, without a new entry.
    setLinkCorrected(true);
    commit({ filters, sort }, { replace: true });
  }, [commit, dropped, filters, sort]);

  const dismissLinkCorrection = useCallback(() => setLinkCorrected(false), []);

  return { filters, sort, commit, linkCorrected, dismissLinkCorrection };
}
