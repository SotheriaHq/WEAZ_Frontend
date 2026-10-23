import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import ImageWithFallback from '@/components/ImageWithFallback';
import { CLIP_EMOJI, clipActionLabel } from '@/constants/clipping';
import { useClipTarget } from '@/features/clipping/useClipTarget';
import { useSavedStatusQuery } from '@/query/queries';
import type { StoreProduct } from '@/components/designs/StoreProductCard';

/**
 * Editorial Curation Flagship Hero: "Trending now on WIEZ".
 * Designed according to Image 1 luxury editorial standards:
 * - Rounded cards with no sharp edges (rounded-3xl).
 * - Left column: Artisanal custom fit hero card with angle switcher,
 *   investment value, custom fit order CTA and details button.
 * - Right column: "Up Next in Discovery" queue with ranked cards (#2, #3, #4),
 *   subtle status badges (Quick View, Custom Fit Only, Ready to Ship),
 *   and full editorial queue trigger.
 * - Dual responsive handling: scales down gracefully on tablet and mobile viewports.
 * - Retains Naira (₦) exclusively per user specification.
 */

const FRAME_MS = 3400;
const MAX_AUTO_FRAMES = 6;

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const priceOf = (product: StoreProduct): string =>
  currency.format(
    (product as { effectivePrice?: number; price?: number }).effectivePrice ||
      (product as { price?: number }).price ||
      0,
  );

const framesOf = (product: StoreProduct | null): string[] => {
  if (!product) return [];
  const source = product as { thumbnail?: string | null; images?: (string | null)[] };
  const all = [source.thumbnail, ...(source.images ?? [])];
  const seen = new Set<string>();
  const frames: string[] = [];
  for (const url of all) {
    const trimmed = String(url ?? '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    frames.push(trimmed);
  }
  return frames;
};

const resolveStatusBadge = (product: StoreProduct): { label: string; className: string } => {
  if (product.isCustomOrderOnly) {
    return {
      label: 'Custom Fit Only',
      className:
        'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300',
    };
  }
  if (product.customAvailable) {
    return {
      label: 'Custom Fit Ready',
      className:
        'border-purple-300/60 bg-purple-500/10 text-purple-700 dark:border-purple-500/30 dark:text-purple-300',
    };
  }
  if (product.totalStock > 0 && !product.isOutOfStock) {
    return {
      label: 'Ready to Ship',
      className:
        'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300',
    };
  }
  return {
    label: 'Quick View',
    className:
      'border-gray-200/80 bg-gray-100/70 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300',
  };
};

const ClipButton: React.FC<{ product: StoreProduct }> = ({ product }) => {
  const { toggleClip } = useClipTarget();
  const statusQuery = useSavedStatusQuery('PRODUCT', product.id);
  const clipped = statusQuery.data === true;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void toggleClip({ targetType: 'PRODUCT', targetId: product.id, clipped });
      }}
      aria-pressed={clipped}
      aria-label={clipActionLabel(clipped)}
      title={clipActionLabel(clipped)}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-base backdrop-blur-md transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-95 ${
        clipped
          ? 'bg-purple-600 text-white shadow-md hover:bg-purple-500'
          : 'bg-black/40 text-white border border-white/15 hover:bg-black/60'
      }`}
    >
      <span aria-hidden="true">{CLIP_EMOJI}</span>
    </button>
  );
};

export interface MarketTrendingHeroProps {
  products: StoreProduct[];
  onOpenProduct: (product: StoreProduct, metadata?: Record<string, unknown>) => void;
  onSeeAll: () => void;
  upNextCount?: number;
}

export const MarketTrendingHero: React.FC<MarketTrendingHeroProps> = ({
  products,
  onOpenProduct,
  onSeeAll,
  upNextCount = 3,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [steering, setSteering] = useState(false);

  const active = products[activeIndex] ?? products[0] ?? null;
  const frames = useMemo(() => framesOf(active), [active]);

  const upNext = useMemo(() => {
    const rows: Array<{ product: StoreProduct; rank: number }> = [];
    for (let offset = 1; offset <= upNextCount && offset < products.length; offset += 1) {
      const idx = (activeIndex + offset) % products.length;
      rows.push({
        product: products[idx],
        rank: offset + 1,
      });
    }
    return rows;
  }, [products, activeIndex, upNextCount]);

  useEffect(() => {
    setActiveIndex((current) => (current < products.length ? current : 0));
  }, [products.length]);

  useEffect(() => {
    setFrameIndex(0);
  }, [active?.id]);

  useEffect(() => {
    if (steering || frames.length === 0 || products.length === 0) return;

    const autoFrames = Math.min(frames.length, MAX_AUTO_FRAMES);
    const timer = window.setInterval(() => {
      setFrameIndex((previous) => {
        const next = previous + 1;
        if (next < autoFrames) return next;
        setActiveIndex((current) => (current + 1) % products.length);
        return 0;
      });
    }, FRAME_MS);

    return () => window.clearInterval(timer);
  }, [steering, frames.length, products.length, active?.id]);

  const stepFrame = useCallback(
    (delta: number) => {
      setSteering(true);
      setFrameIndex((previous) => (previous + delta + frames.length) % frames.length);
    },
    [frames.length],
  );

  if (products.length === 0 || !active) {
    return (
      <div className="flex h-[13rem] items-center justify-center rounded-3xl border border-gray-200/60 bg-gray-50/50 text-sm text-[color:var(--text-secondary)] dark:border-white/10 dark:bg-white/5 sm:h-[16rem] lg:h-[24rem]">
        No trending pieces yet today.
      </div>
    );
  }

  const frame = frames[frameIndex] ?? frames[0] ?? null;
  const isCustom = active.isCustomOrderOnly || active.customAvailable;
  const badgeLabel = isCustom
    ? 'HANDCRAFTED • ARTISANAL CUSTOM FIT'
    : 'HANDPICKED • READY TO WEAR';

  return (
    <section
      aria-labelledby="market-trending-heading"
      data-testid="market-trending-hero"
      className="w-full"
    >
      {/* Header section matching Image 1 */}
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--brand-primary,#9333EA)]">
          EDITORIAL CURATION
        </p>
        <h2
          id="market-trending-heading"
          className="mt-1 font-serif text-2xl tracking-tight text-gray-900 dark:text-white sm:text-3xl lg:text-4xl"
        >
          Trending now on <span className="font-normal italic">WIEZ</span>
        </h2>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1.15fr)] lg:gap-6">
        {/* ── Left Hero Card (Image 1 Parity) ── */}
        <div
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-200/60 bg-[#120d18] text-white shadow-xl dark:border-white/10 min-h-[460px] sm:min-h-[500px] lg:min-h-[520px]"
          onMouseEnter={() => setSteering(true)}
          onFocusCapture={() => setSteering(true)}
        >
          {/* Top Pill & Action Bar */}
          <div className="relative z-20 flex items-center justify-between p-4 sm:p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              {badgeLabel}
            </span>
            <ClipButton product={active} />
          </div>

          {/* Central Image Layer with Smooth Transitions */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <AnimatePresence initial={false}>
              <motion.div
                key={`${active.id}-${frameIndex}`}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <ImageWithFallback
                  src={frame}
                  alt={`${active.name} — view ${frameIndex + 1} of ${frames.length}`}
                  fit="cover"
                  rounded="none"
                  containerClassName="h-full w-full"
                  className="h-full w-full object-cover object-center"
                  maxHeightClassName="max-h-full"
                  fallbackName={active.name}
                />
              </motion.div>
            </AnimatePresence>

            {/* Gradient Scrims: Dark gradient overlay ensuring crisp typography */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120d18] via-[#120d18]/40 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120d18]/60 via-transparent to-transparent" />
          </div>

          {/* Manual Angle Switch Controls */}
          {frames.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous view"
                onClick={() => stepFrame(-1)}
                className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur-md transition hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <span aria-hidden="true" className="text-lg leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next view"
                onClick={() => stepFrame(1)}
                className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur-md transition hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <span aria-hidden="true" className="text-lg leading-none">›</span>
              </button>
            </>
          ) : null}

          {/* Card Body & Information */}
          <div className="relative z-10 p-5 sm:p-7 pt-24 sm:pt-32">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/90">
              {active.brand?.name ? `${active.brand.name.toUpperCase()} STUDIO` : 'WIEZ MASTER ATELIER'}
              <span className="text-white/40"> • </span>
              <span>LAGOS & PARIS</span>
            </p>

            <h3 className="mt-1.5 max-w-2xl font-serif text-2xl font-normal leading-tight text-white sm:text-3xl lg:text-4xl">
              {active.name}
            </h3>

            {/* Investment Strip & Actions */}
            <div className="mt-5 border-t border-white/10 pt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  INVESTMENT VALUE
                </p>
                <p className="mt-0.5 font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {priceOf(active)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenProduct(active, { source: 'market_hero_custom_fit' })}
                  className="rounded-full bg-purple-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-purple-600 active:scale-95"
                >
                  {isCustom ? 'CUSTOM FIT ORDER →' : 'ADD TO BAG →'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProduct(active, { source: 'market_hero_details' })}
                  className="rounded-full border border-white/25 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-95"
                >
                  DETAILS
                </button>
              </div>
            </div>

            {/* Angle Indicator Dots */}
            {frames.length > 1 ? (
              <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Views">
                {frames.slice(0, MAX_AUTO_FRAMES).map((frameUrl, index) => (
                  <button
                    key={frameUrl}
                    type="button"
                    role="tab"
                    aria-selected={index === frameIndex}
                    aria-label={`View ${index + 1}`}
                    onClick={() => {
                      setSteering(true);
                      setFrameIndex(index);
                    }}
                    className={`h-1 rounded-full transition-all ${
                      index === frameIndex ? 'w-8 bg-purple-400' : 'w-2.5 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Right Column: Up Next in Discovery (Image 1 Parity) ── */}
        <div className="flex flex-col justify-between rounded-3xl border border-gray-200/70 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-[#15101c]/80 backdrop-blur-md">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
                  Up Next in Discovery
                </h3>
              </div>
              <button
                type="button"
                onClick={onSeeAll}
                className="text-xs font-bold uppercase tracking-wider text-purple-700 transition hover:underline dark:text-purple-400"
              >
                SEE ALL ({products.length}) &gt;
              </button>
            </div>

            <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Upcoming items queued in this editorial cycle. Distinct from your personal custom-order crafting queue.
            </p>

            {/* Queue List of Items */}
            <div className="mt-4 space-y-3">
              {upNext.map(({ product, rank }) => {
                const badge = resolveStatusBadge(product);
                return (
                  <div
                    key={product.id}
                    onClick={() => onOpenProduct(product, { source: 'market_hero_up_next' })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onOpenProduct(product, { source: 'market_hero_up_next' });
                      }
                    }}
                    className="group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-gray-100 bg-white/80 p-3 transition hover:border-purple-300 hover:shadow-md dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-purple-500/30"
                  >
                    {/* Thumbnail with Rank Badge (#2, #3, #4) */}
                    <div className="relative h-18 w-18 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-purple-50/50 dark:bg-white/5">
                      <ImageWithFallback
                        src={product.thumbnail || product.images?.[0] || null}
                        alt={product.name}
                        fit="cover"
                        rounded="none"
                        containerClassName="h-full w-full"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        maxHeightClassName="max-h-full"
                        fallbackName={product.name}
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                        #{rank}
                      </span>
                    </div>

                    {/* Meta Details */}
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 truncate">
                        {product.brand?.name || 'WIEZ ATELIER'}
                      </p>
                      <h4 className="font-serif text-sm font-semibold leading-snug text-gray-900 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        {product.name}
                      </h4>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {priceOf(product)}
                        </span>
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Action */}
          <div className="mt-5 border-t border-gray-100 pt-3 dark:border-white/10">
            <button
              type="button"
              onClick={onSeeAll}
              className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
            >
              <span>VIEW FULL EDITORIAL QUEUE ({products.length} PIECES)</span>
              <span aria-hidden="true" className="text-base leading-none">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketTrendingHero;
