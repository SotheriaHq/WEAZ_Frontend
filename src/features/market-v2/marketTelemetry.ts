import { useCallback, useEffect, useRef } from 'react';
import type { MarketSignalEvent, MarketSignalSurface } from '@/api/MarketApi';
import type { MarketV2Item } from '@/api/MarketV2Api';
import { getSectionItemTargetId } from '@/utils/marketSectionMapper';

/** Same shapes the signal endpoint validates; anything else is left out. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
const POLICY_VERSION = /^[A-Za-z0-9][A-Za-z0-9_.@:-]{0,39}$/;

export interface MarketSignalContext {
  readonly surface: MarketSignalSurface;
  readonly sectionKey?: string;
  /** Feature epoch of the response, when the server sent one. */
  readonly epoch?: string | null;
  readonly policyVersion?: string | null;
}

/**
 * The signal for one card, carrying only telemetry that is actually known:
 * the server's position (else the rendered one), the epoch and policy version
 * when they are in a shape the server accepts, and `explore` only when the
 * server disclosed it.
 */
export function marketCardSignal(
  item: MarketV2Item,
  index: number,
  context: MarketSignalContext,
  signalType: MarketSignalEvent['signalType'],
  extra?: { visibleMs?: number },
): MarketSignalEvent | null {
  const targetId = getSectionItemTargetId(item);
  if (!targetId) return null;
  return {
    targetType: item.entityType,
    targetId,
    signalType,
    surface: context.surface,
    ...(context.sectionKey ? { sectionKey: context.sectionKey } : {}),
    position: typeof item.position === 'number' ? item.position : index,
    occurredAt: new Date().toISOString(),
    ...(extra?.visibleMs !== undefined ? { visibleMs: Math.max(0, Math.min(3_600_000, Math.round(extra.visibleMs))) } : {}),
    ...(context.epoch && ISO_INSTANT.test(context.epoch) ? { epoch: context.epoch } : {}),
    ...(context.policyVersion && POLICY_VERSION.test(context.policyVersion)
      ? { policyVersion: context.policyVersion }
      : {}),
    ...(typeof item.explore === 'boolean' ? { explore: item.explore } : {}),
  };
}

/** A card counts as seen when at least half of it stays visible this long. */
export const MARKET_IMPRESSION_DWELL_MS = 500;
const IMPRESSION_MEMORY_LIMIT = 2000;
const impressed = new Set<string>();

const rememberImpression = (key: string): boolean => {
  if (impressed.has(key)) return false;
  impressed.add(key);
  if (impressed.size > IMPRESSION_MEMORY_LIMIT) {
    const oldest = impressed.values().next().value;
    if (oldest !== undefined) impressed.delete(oldest);
  }
  return true;
};

/** Test seam. */
export const resetMarketImpressions = () => impressed.clear();

type Watched = { item: MarketV2Item; index: number; since: number | null; timer: number | null };

/**
 * Impressions for one list: one per card per section per epoch, recorded when
 * the card has been at least half visible for 500 ms. Returns a ref callback
 * factory for the card cells; one observer serves the whole list.
 */
export function useMarketImpressions(
  context: MarketSignalContext,
  track: (event: MarketSignalEvent) => void,
) {
  const contextRef = useRef(context);
  const trackRef = useRef(track);
  useEffect(() => {
    contextRef.current = context;
    trackRef.current = track;
  });
  const watched = useRef(new Map<Element, Watched>());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const keyOf = (item: MarketV2Item) => {
    const { sectionKey, epoch } = contextRef.current;
    return `${sectionKey ?? ''}:${item.entityType}:${getSectionItemTargetId(item)}:${epoch ?? ''}`;
  };

  const getObserver = useCallback(() => {
    if (observerRef.current || typeof IntersectionObserver === 'undefined') return observerRef.current;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const state = watched.current.get(entry.target);
          if (!state) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (state.timer !== null) continue;
            state.since = performance.now();
            state.timer = window.setTimeout(() => {
              state.timer = null;
              const key = keyOf(state.item);
              if (!rememberImpression(key)) return;
              const event = marketCardSignal(state.item, state.index, contextRef.current, 'IMPRESSION', {
                visibleMs: performance.now() - (state.since ?? performance.now()),
              });
              if (event) trackRef.current(event);
              observerRef.current?.unobserve(entry.target);
              watched.current.delete(entry.target);
            }, MARKET_IMPRESSION_DWELL_MS);
          } else if (state.timer !== null) {
            window.clearTimeout(state.timer);
            state.timer = null;
            state.since = null;
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    return observerRef.current;
  }, []);

  useEffect(() => {
    const map = watched.current;
    return () => {
      for (const state of map.values()) if (state.timer !== null) window.clearTimeout(state.timer);
      map.clear();
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  /**
   * Ref callback for one card cell. Memoise it per card (item and index) so a
   * re-render does not restart the dwell timer; React runs the returned
   * cleanup when the cell leaves the list.
   */
  return useCallback(
    (item: MarketV2Item, index: number) => (node: Element | null) => {
      if (!node || impressed.has(keyOf(item))) return undefined;
      const observer = getObserver();
      if (!observer) return undefined;
      watched.current.set(node, { item, index, since: null, timer: null });
      observer.observe(node);
      return () => {
        const state = watched.current.get(node);
        if (state?.timer != null) window.clearTimeout(state.timer);
        watched.current.delete(node);
        observerRef.current?.unobserve(node);
      };
    },
    [getObserver],
  );
}
