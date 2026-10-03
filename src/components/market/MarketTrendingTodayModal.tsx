import React, { useEffect, useMemo, useRef } from 'react';

import ImageWithFallback from '@/components/ImageWithFallback';
import type { StoreProduct } from '@/components/designs/StoreProductCard';

/**
 * Everything trending TODAY — the whole list behind the hero's "See all".
 *
 * Deliberately today only. The hero shows what is trending now, so "see all"
 * has to mean "all of that", not "the catalogue". A shopper who opens this and
 * finds last month's pieces has been told the hero was arbitrary; one who finds
 * the same day's set, in the same order, has been told it was a selection.
 *
 * The list therefore takes the SAME array the hero is drawing from, extended
 * to however many the day actually has, rather than running its own query with
 * its own idea of what is trending.
 */

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

export interface MarketTrendingTodayModalProps {
  open: boolean;
  products: StoreProduct[];
  onClose: () => void;
  onOpenProduct: (product: StoreProduct, metadata?: Record<string, unknown>) => void;
}

export const MarketTrendingTodayModal: React.FC<MarketTrendingTodayModalProps> = ({
  open,
  products,
  onClose,
  onOpenProduct,
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    // The page behind must not scroll under the sheet.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    [],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trending-today-heading"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[color:var(--surface-primary)] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">
              Trending today
            </p>
            <h2
              id="trending-today-heading"
              className="mt-1 font-serif text-2xl leading-tight text-[color:var(--text-primary)]"
            >
              {dayLabel}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              {products.length} {products.length === 1 ? 'piece' : 'pieces'} trending on WIEZ today.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-lg leading-none text-[color:var(--text-secondary)] transition hover:bg-black/[0.09] dark:bg-white/10 dark:hover:bg-white/20"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {products.length === 0 ? (
            <p className="py-10 text-center text-sm text-[color:var(--text-secondary)]">
              Nothing is trending yet today. Check back shortly.
            </p>
          ) : (
            <ol className="space-y-2">
              {products.map((product, index) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProduct(product, { source: 'market_trending_today', position: index });
                      onClose();
                    }}
                    className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left ring-1 ring-black/[0.06] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)] hover:ring-black/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] dark:ring-white/10 dark:hover:ring-white/20"
                  >
                    {/* The rank is the reason this list has an order. */}
                    <span className="w-6 shrink-0 text-center font-serif text-lg text-[color:var(--text-secondary)]">
                      {index + 1}
                    </span>
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
                      <ImageWithFallback
                        src={product.thumbnail || product.images?.[0] || null}
                        alt={product.name}
                        fit="cover"
                        rounded="none"
                        containerClassName="absolute inset-0 h-full w-full"
                        className="h-full w-full transition-transform duration-500 group-hover:scale-[1.07]"
                        maxHeightClassName="max-h-full"
                        fallbackName={product.name}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
                        {product.brand?.name || 'WIEZ Brand'}
                      </span>
                      <span className="mt-0.5 truncate font-serif text-base leading-tight text-[color:var(--text-primary)]">
                        {product.name}
                      </span>
                    </span>
                    <span className="shrink-0 pr-1 text-sm font-semibold text-[color:var(--text-primary)]">
                      {priceOf(product)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketTrendingTodayModal;
