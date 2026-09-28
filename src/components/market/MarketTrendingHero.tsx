import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import ImageWithFallback from '@/components/ImageWithFallback';
import { CLIPPED_EMOJI, CLIP_EMOJI, clipActionLabel } from '@/constants/clipping';
import { useClipTarget } from '@/features/clipping/useClipTarget';
import { useSavedStatusQuery } from '@/query/queries';
import type { StoreProduct } from '@/components/designs/StoreProductCard';

/**
 * The Market's opening statement: one piece shown properly, and what is next.
 *
 * ## What this replaced
 *
 * A two-column slab where the left side rotated between three PRODUCTS every
 * 4.5 seconds and showed one photograph of each, and the right side was two
 * more photographs with "✨ Tap to preview" written on them. Three problems,
 * and only the last is cosmetic:
 *
 * 1. A shopper never saw a garment twice. The thing they were reading swapped
 *    out from under them on a timer they did not control.
 * 2. Every product here has four to six angles and the hero showed one. The
 *    other angles are the reason a person buys clothing online.
 * 3. "Tap to preview" is not information. The rows now carry the brand, the
 *    piece and the price — what a shopper decides on.
 *
 * ## How it behaves
 *
 * The hero walks the ACTIVE piece's own angles, and only when it has shown all
 * of them does it move to the next piece. So the rotation is a consequence of
 * having finished something rather than an interruption of it. Any hover, any
 * arrow, any dot stops the timer for good — once someone is steering, taking
 * the wheel back is rude.
 */

/** Long enough to look at a garment, short enough to feel alive. */
const FRAME_MS = 3200;
/** Angles beyond this are still reachable by arrow; they just do not autoplay. */
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

/**
 * Every angle this piece has, in order, without duplicates.
 *
 * `thumbnail` is usually also `images[0]`; showing it twice reads as the
 * carousel stalling.
 */
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

/**
 * Clip, in the brand's own vocabulary.
 *
 * The reference design put a heart here. A heart is a like — a broadcast
 * opinion about someone else's work. Clipping is private and practical: this
 * piece goes on my board. They are different promises, and the product only
 * makes one of them.
 */
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
      className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-base backdrop-blur-md transition hover:scale-105 hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-95"
    >
      <span aria-hidden="true">{clipped ? CLIPPED_EMOJI : CLIP_EMOJI}</span>
    </button>
  );
};

export interface MarketTrendingHeroProps {
  /** Today's trending pieces, already day-scoped by the caller. */
  products: StoreProduct[];
  onOpenProduct: (product: StoreProduct, metadata?: Record<string, unknown>) => void;
  /** Opens the full list for today. */
  onSeeAll: () => void;
  /** How many rows the right column shows before "See all". */
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
  /*
    The pieces that FOLLOW this one, wrapping — a queue, not "everything except
    the current one". Filtering the active item out of the whole list would
    reshuffle all three rows on every rotation; taking the next few means each
    row moves up by one, which is what the heading promises.
  */
  const upNext = useMemo(() => {
    const rows: StoreProduct[] = [];
    for (let offset = 1; offset <= upNextCount && offset < products.length; offset += 1) {
      rows.push(products[(activeIndex + offset) % products.length]);
    }
    return rows;
  }, [products, activeIndex, upNextCount]);

  // A shorter list than last render must not leave the pointer past its end.
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
        // Finished this piece — hand over to the next one.
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
      <div className="flex h-[13rem] items-center justify-center rounded-3xl bg-black/[0.03] text-sm text-[color:var(--text-secondary)] dark:bg-white/5 sm:h-[16rem] lg:h-[24rem]">
        No trending pieces yet today.
      </div>
    );
  }

  const frame = frames[frameIndex] ?? frames[0] ?? null;

  return (
    <section aria-labelledby="market-trending-heading">
      {/*
        The gap under the navbar is set here and nowhere else. The eyebrow sits
        on the same left edge as the hero below it, so the column reads as one
        block rather than a title that happens to be above a picture.
      */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--brand-primary)]">
            Market
          </p>
          <h2
            id="market-trending-heading"
            className="mt-1.5 font-serif text-[1.75rem] leading-[1.1] tracking-[-0.01em] text-[color:var(--text-primary)] sm:text-[2.125rem]"
          >
            Trending now on <em className="not-italic text-[color:var(--brand-primary)]">WIEZ</em>
          </h2>
        </div>
      </div>

      {/*
        The height lives on the GRID, and both columns take it.

        It used to sit on the hero card alone, so the right column was free to
        grow past it — three rows plus a header against a fixed 24rem picture,
        and the bottom edges did not line up. Now the row defines the height
        once and "Up next" divides whatever is left after its own header.
      */}
      <div className="grid gap-3 lg:h-[24rem] lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:gap-4">
        {/* ── The piece ───────────────────────────────────────────────── */}
        <div
          className="group relative h-[15rem] overflow-hidden rounded-3xl bg-[#1b1022] sm:h-[19rem] lg:h-full"
          onMouseEnter={() => setSteering(true)}
          onFocusCapture={() => setSteering(true)}
        >
          {/*
            An overlapping crossfade, not `mode="wait"`.

            `wait` holds the new frame back until the old one has finished
            leaving, so pressing the arrow did nothing visible for the length of
            the exit — on a carousel that reads as a dropped input. Both frames
            are absolutely positioned, so letting them coexist for the fade is
            free, and the new angle appears the moment it is asked for.
          */}
          <AnimatePresence initial={false}>
            <motion.div
              key={`${active.id}-${frameIndex}`}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <ImageWithFallback
                src={frame}
                alt={`${active.name} — view ${frameIndex + 1} of ${frames.length}`}
                fit="cover"
                rounded="none"
                containerClassName="h-full w-full"
                className="h-full w-full"
                maxHeightClassName="max-h-full"
                fallbackName={active.name}
              />
            </motion.div>
          </AnimatePresence>

          {/* Two stops, weighted to the bottom: the copy sits in ink while the
              garment above it keeps its own light. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

          <ClipButton product={active} />

          {frames.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous view"
                onClick={() => stepFrame(-1)}
                className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-md transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <span aria-hidden="true" className="text-lg leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next view"
                onClick={() => stepFrame(1)}
                className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-md transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <span aria-hidden="true" className="text-lg leading-none">›</span>
              </button>
            </>
          ) : null}

          <div className="relative flex h-full flex-col justify-end p-4 text-white sm:p-6">
            <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-md sm:text-[11px]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-accent,#d4af37)]" />
              Trending now
            </span>

            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {active.brand?.name || 'WIEZ Brand'}
            </p>
            <h3 className="mt-1 max-w-xl font-serif text-2xl leading-[1.08] sm:text-4xl">
              {active.name}
            </h3>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
              <button
                type="button"
                onClick={() => onOpenProduct(active, { source: 'market_hero' })}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900 transition hover:scale-[1.03] active:scale-95 sm:text-sm"
              >
                View product
              </button>
              <span className="font-serif text-lg font-semibold sm:text-xl">{priceOf(active)}</span>
            </div>

            {frames.length > 1 ? (
              <div className="mt-3 flex items-center gap-1.5" role="tablist" aria-label="Views">
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
                      index === frameIndex ? 'w-7 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Up next ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
              Up next
            </p>
            <button
              type="button"
              onClick={onSeeAll}
              className="rounded-full text-xs font-semibold text-[color:var(--brand-primary)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
            >
              See all
            </button>
          </div>

          {/*
            Rows, not tiles. Each one is the same height and the thumbnail is a
            fixed square, so the brand, the name and the price start on the same
            x at every row — which is the alignment the reference gets its calm
            from, and which photographs of different shapes had been destroying.
          */}
          <ul className="flex min-h-0 flex-1 flex-col gap-2">
            {upNext.map((product) => (
              <li key={product.id} className="min-h-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpenProduct(product, { source: 'market_hero_up_next' })}
                  className="group/row flex h-full w-full items-center gap-3 rounded-2xl bg-white/70 p-2 text-left ring-1 ring-black/[0.06] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.65)] hover:ring-black/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] dark:bg-white/[0.04] dark:ring-white/10 dark:hover:ring-white/20"
                >
                  <span className="relative h-full w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-black/5 sm:w-[5.5rem] dark:bg-white/10">
                    <ImageWithFallback
                      src={product.thumbnail || product.images?.[0] || null}
                      alt={product.name}
                      fit="cover"
                      rounded="none"
                      containerClassName="absolute inset-0 h-full w-full"
                      className="h-full w-full transition-transform duration-500 group-hover/row:scale-[1.07]"
                      maxHeightClassName="max-h-full"
                      fallbackName={product.name}
                    />
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col justify-center">
                    <span className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
                      {product.brand?.name || 'WIEZ Brand'}
                    </span>
                    <span className="mt-0.5 truncate font-serif text-base leading-tight text-[color:var(--text-primary)] sm:text-lg">
                      {product.name}
                    </span>
                    <span className="mt-0.5 text-sm font-semibold text-[color:var(--text-primary)]">
                      {priceOf(product)}
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-sm text-[color:var(--text-secondary)] transition group-hover/row:bg-[color:var(--brand-primary)] group-hover/row:text-white dark:bg-white/10"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default MarketTrendingHero;
