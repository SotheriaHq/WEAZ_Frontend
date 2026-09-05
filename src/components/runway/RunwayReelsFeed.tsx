import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketItem } from '@/types/market';
import { RunwayReelsItem } from '@/components/runway/RunwayReelsItem';
import DesignSkeleton from '@/components/designs/DesignSkeleton';

export type RunwayReelsFeedProps = {
  items: MarketItem[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  onOpenView?: (item: MarketItem) => void;
  onOpenComments?: (item: MarketItem) => void;
  onViewBrand?: (brandId: string, item: MarketItem) => void;
  onViewCollection?: (collectionId: string) => void;
  isSaved?: (id: string) => boolean;
  saveBusy?: (id: string) => boolean;
  onToggleSave?: (id: string) => void;
  isPatched?: (brandId: string) => boolean;
  patchBusy?: (brandId: string) => boolean;
  onTogglePatch?: (brandId: string) => void;
  /** Optional overlay (category chips) rendered above the snap scroller. */
  header?: React.ReactNode;
  /**
   * Scroll and touch handlers for the stage, from `useAutoHideNavOnScroll`.
   *
   * The stage is its own `overflow-y-auto` element, so `window.scrollY` never
   * moves and nothing above this component can observe the feed being scrolled.
   * The touch pair is not optional: scroll events stop firing the moment a
   * finger stops moving even though it is still down and about to fling again,
   * so without them the navbar returns under a resting thumb mid-gesture.
   */
  scrollHandlers?: {
    onScroll: () => void;
    onTouchStart: () => void;
    onTouchEnd: () => void;
  };
  className?: string;
};

/**
 * Mobile-browser / responsive-phone Runway surface.
 *
 * Vertical CSS scroll-snap (mandatory + always) is the web equivalent of the
 * native feed's `pagingEnabled`: each design fills the stage, exactly one page
 * moves per gesture, and the browser owns the settle animation. No JS scroll
 * hijacking — that lags badly next to platform snap physics.
 *
 * Do NOT "restore parity" with native `snapToInterval` +
 * `disableIntervalMomentum` (which earlier revisions of this comment claimed to
 * mirror). Native moved off that pair precisely because it made the settle
 * accelerate into the target instead of easing into it, and the mobile guard
 * test now fails the build if they come back. `y mandatory` +
 * `scroll-snap-stop: always` is the correct analogue of what native does today.
 *
 * The per-page transit treatment (scrim, scale, chrome fade) is not here — it is
 * scroll-driven CSS in index.css, keyed to each reel's own `view()` progress.
 * See "Runway reel transit treatment" there.
 */
export const RunwayReelsFeed: React.FC<RunwayReelsFeedProps> = ({
  items,
  isLoading = false,
  hasNextPage = false,
  isFetchingMore = false,
  onLoadMore,
  onOpenView,
  onOpenComments,
  onViewBrand,
  isSaved,
  saveBusy,
  onToggleSave,
  isPatched,
  patchBusy,
  onTogglePatch,
  header,
  scrollHandlers,
  className,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const loadMoreArmedRef = useRef(true);
  const activeIndexRef = useRef(0);

  // Measure active reel via IntersectionObserver (native viewability parity).
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || items.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.runwayReelId;
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (!bestId || bestRatio < 0.35) return;
        const nextIndex = items.findIndex((item) => item.id === bestId);
        if (nextIndex < 0 || nextIndex === activeIndexRef.current) return;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);

        // Prefetch / page when within 2 of the end (native: length - 2).
        if (
          hasNextPage &&
          onLoadMore &&
          loadMoreArmedRef.current &&
          nextIndex >= items.length - 2
        ) {
          loadMoreArmedRef.current = false;
          onLoadMore();
        }
      },
      {
        root,
        // Snap pages are full height — require substantial visibility.
        threshold: [0.35, 0.55, 0.75, 0.9],
      },
    );

    const nodes = root.querySelectorAll<HTMLElement>('[data-runway-reel-id]');
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [hasNextPage, items, onLoadMore]);

  // Re-arm load-more after a fetch cycle completes or the list grows.
  useEffect(() => {
    if (!isFetchingMore) {
      loadMoreArmedRef.current = true;
    }
  }, [isFetchingMore, items.length]);

  // Reset active index when the feed identity changes (category switch).
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    const root = scrollerRef.current;
    if (root) {
      root.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [items[0]?.id]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const root = scrollerRef.current;
      if (!root || items.length === 0) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'PageDown' && event.key !== 'PageUp') {
        return;
      }
      event.preventDefault();
      const delta =
        event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : -1;
      const next = Math.max(0, Math.min(items.length - 1, activeIndexRef.current + delta));
      const target = root.querySelector<HTMLElement>(
        `[data-runway-reel-id="${items[next]?.id}"]`,
      );
      if (target) {
        // Smooth programmatic step so keyboard users see the same handoff.
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [items],
  );

  if (isLoading && items.length === 0) {
    return (
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden bg-black ${className ?? ''}`}
        aria-busy="true"
        aria-label="Loading runway"
      >
        <div className="pt-16">{header}</div>
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="w-full max-w-sm opacity-80">
            <DesignSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden bg-black ${className ?? ''}`}
    >
      {/* `pt-16` clears the floating navbar. The stage is full-bleed (media runs
          edge to edge behind the transparent bar), so the chips must be pushed
          below it rather than the stage being shortened to make room. */}
      {header ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-16">
          <div className="pointer-events-auto">{header}</div>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        onScroll={scrollHandlers?.onScroll}
        onTouchStart={scrollHandlers?.onTouchStart}
        onTouchEnd={scrollHandlers?.onTouchEnd}
        onTouchCancel={scrollHandlers?.onTouchEnd}
        role="feed"
        aria-label="Runway reels"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="runway-reels-scroller h-full w-full flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          // Browser snap physics handle the settle animation (IG-class speed).
          // Do not set scroll-behavior:smooth on the scroller itself — it
          // stacks with snap and makes flings feel laggy.
          scrollBehavior: 'auto',
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className="w-full shrink-0"
            style={{
              // Match scroller viewport (not content height) so each design
              // fills the stage exactly once — required for stable CSS snap.
              height: '100%',
              minHeight: '100%',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
          >
            <RunwayReelsItem
              item={item}
              isActive={index === activeIndex}
              priority={index < 2}
              isSaved={isSaved?.(item.id)}
              saveBusy={saveBusy?.(item.id)}
              isPatched={item.brandId ? isPatched?.(item.brandId) : false}
              patchBusy={item.brandId ? patchBusy?.(item.brandId) : false}
              onOpenView={onOpenView}
              onOpenComments={onOpenComments}
              onViewBrand={onViewBrand}
              onToggleSave={onToggleSave}
              onTogglePatch={onTogglePatch}
            />
          </div>
        ))}

        {isFetchingMore ? (
          <div
            className="flex h-16 w-full shrink-0 items-center justify-center text-xs font-semibold text-white/70"
            aria-live="polite"
          >
            Loading more…
          </div>
        ) : null}

        {!hasNextPage && items.length > 0 ? (
          <div className="flex h-12 w-full shrink-0 items-center justify-center text-[11px] font-medium text-white/45">
            You’re caught up
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RunwayReelsFeed;
