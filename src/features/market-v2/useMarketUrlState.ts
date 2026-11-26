import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseMarketUrlState,
  serializeMarketUrlState,
  type MarketUrlState,
} from './marketFilterState';

export interface MarketUrlStateApi extends MarketUrlState {
  /**
   * Write a new state. Filter and sort changes replace the current history
   * entry (the Market convention: navigation pushes, refinements replace), so
   * Back leaves the page instead of undoing chips one at a time. Pass
   * `{ replace: false }` for a change that is a navigation.
   */
  readonly commit: (next: MarketUrlState, options?: { replace?: boolean }) => void;
  /** Some Market parameters in the opened link could not be used. */
  readonly linkCorrected: boolean;
  readonly dismissLinkCorrection: () => void;
}

/** Filters and sort live in the URL, so reload, Back/Forward and a shared link all restore them. */
export function useMarketUrlState(): MarketUrlStateApi {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = useMemo(() => parseMarketUrlState(searchParams), [searchParams]);
  const [linkCorrected, setLinkCorrected] = useState(false);

  const commit = useCallback(
    (next: MarketUrlState, options?: { replace?: boolean }) => {
      setSearchParams((previous) => serializeMarketUrlState(next, previous), {
        replace: options?.replace ?? true,
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
