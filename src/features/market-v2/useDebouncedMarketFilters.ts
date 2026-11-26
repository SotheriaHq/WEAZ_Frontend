import { useCallback, useEffect, useRef, useState } from 'react';
import { marketFiltersKey, type MarketFilters } from './marketFilterState';

export const MARKET_FILTER_DEBOUNCE_MS = 250;

/**
 * Filter chips in the side panel apply on their own, 250 ms after the last
 * change, so a run of quick taps sends one request. The panel shows the draft
 * at once; a change that arrives from the URL (Back, a chip removed elsewhere)
 * replaces the draft.
 */
export function useDebouncedMarketFilters(
  applied: MarketFilters,
  commit: (next: MarketFilters) => void,
  delayMs = MARKET_FILTER_DEBOUNCE_MS,
): [MarketFilters, (next: MarketFilters) => void] {
  const appliedKey = marketFiltersKey(applied);
  const [draft, setDraft] = useState(applied);
  const [draftFor, setDraftFor] = useState(appliedKey);
  const timerRef = useRef<number | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  // The URL moved on: the applied state wins over any older draft.
  if (draftFor !== appliedKey) {
    setDraftFor(appliedKey);
    setDraft(applied);
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const update = useCallback(
    (next: MarketFilters) => {
      setDraft(next);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        commitRef.current(next);
      }, delayMs);
    },
    [delayMs],
  );

  return [draft, update];
}
