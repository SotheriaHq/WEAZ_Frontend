import React, { useEffect, useMemo, useRef } from 'react';
import type { MarketSignalEvent } from '@/api/MarketApi';
import type { MarketV2ErrorKind, MarketV2Item } from '@/api/MarketV2Api';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import Button from '@/components/ui/Button';
import { useMarketImpressions, type MarketSignalContext } from '@/features/market-v2/marketTelemetry';
import { MarketCardCell, type MarketCardOpen } from './MarketCardCell';
import { marketErrorCopy } from './marketCopy';

export interface MarketCatalogGridProps {
  items: readonly MarketV2Item[];
  loading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  nextPageErrorKind: MarketV2ErrorKind | null;
  onLoadMore: () => void;
  onRetry: () => void;
  context: MarketSignalContext;
  onTrackSignal: (event: MarketSignalEvent) => void;
  onOpen: MarketCardOpen;
  /** Shown when the list is complete and empty. */
  empty: React.ReactNode;
  /** Shown under the last card when the list is complete. */
  exhausted: React.ReactNode;
  columnsClassName?: string;
}

const DEFAULT_COLUMNS = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

/**
 * The keyset list as a grid: infinite scroll from a sentinel, a footer row of
 * skeletons while the next page loads, an inline retry that keeps every loaded
 * card, and an explicit end of list (never an endless spinner).
 */
export function MarketCatalogGrid({
  items,
  loading,
  isFetchingNextPage,
  hasNextPage,
  nextPageErrorKind,
  onLoadMore,
  onRetry,
  context,
  onTrackSignal,
  onOpen,
  empty,
  exhausted,
  columnsClassName = DEFAULT_COLUMNS,
}: MarketCatalogGridProps) {
  const observe = useMarketImpressions(context, onTrackSignal);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canAutoLoad = hasNextPage && !isFetchingNextPage && nextPageErrorKind === null;
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canAutoLoad || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canAutoLoad, items.length]);

  const skeletons = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => (
        <li key={`skeleton-${index}`} aria-hidden="true">
          <ProductCardSkeleton />
        </li>
      )),
    [],
  );

  if (loading) {
    return (
      <ul className={`grid gap-3.5 sm:gap-4 ${columnsClassName}`} aria-busy="true" aria-label="Loading pieces">
        {skeletons}
      </ul>
    );
  }
  if (items.length === 0 && !hasNextPage) return <>{empty}</>;

  return (
    <div className="space-y-6">
      <ul className={`grid gap-3.5 sm:gap-4 ${columnsClassName}`}>
        {items.map((item, index) => (
          <li
            key={`${item.entityType}:${item.id}`}
            className="[contain-intrinsic-size:auto_420px] [content-visibility:auto]"
          >
            <MarketCardCell
              item={item}
              index={index}
              format="product-rail"
              observe={observe}
              onOpen={onOpen}
              priority={index < 4}
            />
          </li>
        ))}
        {isFetchingNextPage ? skeletons : null}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div className="flex flex-col items-center gap-3 pb-10 text-center" role="status" aria-live="polite">
        {nextPageErrorKind ? (
          <>
            <p className="text-sm font-semibold text-[color:var(--wiez-text-secondary)]">
              {marketErrorCopy(nextPageErrorKind).nextPage}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </>
        ) : hasNextPage ? (
          isFetchingNextPage ? (
            <p className="sr-only">Loading more pieces</p>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={onLoadMore}>
              Load more pieces
            </Button>
          )
        ) : (
          exhausted
        )}
      </div>
    </div>
  );
}

export default MarketCatalogGrid;
