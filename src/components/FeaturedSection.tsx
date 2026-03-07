import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { featuredApi, type PublicFeaturedItem } from '@/api/FeaturedApi';
import { unwrapApiResponse } from '@/types/auth';

interface FeaturedSectionProps {
  filterType?: 'PRODUCT' | 'DESIGN';
  onViewProduct?: (productId: string) => void;
  onViewDesign?: (collectionId: string) => void;
  onSeeAll?: () => void;
}

const FeaturedSection: React.FC<FeaturedSectionProps> = ({
  filterType,
  onViewProduct,
  onViewDesign,
  onSeeAll,
}) => {
  const [items, setItems] = useState<PublicFeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await featuredApi.listActive();
        const data = unwrapApiResponse<PublicFeaturedItem[]>(res.data as any);
        const list = Array.isArray(data) ? data : [];
        if (mounted) setItems(filterType ? list.filter((i) => i.entityType === filterType) : list);
      } catch {
        // silently fail — empty section
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [filterType]);

  // Auto-rotate spotlight
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [items.length]);

  const scrollRail = useCallback((direction: 'left' | 'right') => {
    if (!railRef.current) return;
    const amount = Math.round(railRef.current.clientWidth * 0.8);
    railRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  const handleClick = (item: PublicFeaturedItem) => {
    if (item.entityType === 'PRODUCT' && onViewProduct) onViewProduct(item.entityId);
    if (item.entityType === 'DESIGN' && onViewDesign) onViewDesign(item.entityId);
  };

  const formatPrice = (item: PublicFeaturedItem) => {
    if (!item.entityPrice) return null;
    const price = Number(item.entityPrice.salePrice ?? item.entityPrice.price);
    if (!Number.isFinite(price)) return null;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: item.entityPrice.currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-gray-200/80 dark:bg-white/10" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 min-w-[260px] animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const spotlight = items[activeIndex] ?? items[0];
  const thumbnailUrl = (item: PublicFeaturedItem) => {
    if (item.displayImages?.length) return item.displayImages[0];
    return item.entityThumbnail;
  };

  // Single spotlight hero when ≤ 2 items, rail when more
  if (items.length <= 2) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Featured</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="ml-auto text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">
              See all →
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.button
            key={spotlight.id}
            type="button"
            onClick={() => handleClick(spotlight)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="group relative w-full overflow-hidden rounded-2xl border border-amber-200/60 text-left dark:border-amber-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5" />
            <div className="relative flex flex-col sm:flex-row">
              <div className="h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-64">
                {thumbnailUrl(spotlight) ? (
                  <img
                    src={thumbnailUrl(spotlight)!}
                    alt={spotlight.entityName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full min-h-[192px] items-center justify-center bg-amber-100/50 text-3xl dark:bg-amber-500/10">⭐</div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2 p-5">
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  ⭐ Featured {spotlight.entityType === 'PRODUCT' ? 'Product' : 'Design'}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{spotlight.entityName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  by {spotlight.brand?.name ?? 'Brand'}
                </p>
                {formatPrice(spotlight) && (
                  <p className="text-lg font-black text-gray-900 dark:text-white">{formatPrice(spotlight)}</p>
                )}
                <span className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  👀 Tap to view →
                </span>
              </div>
            </div>
          </motion.button>
        </AnimatePresence>

        {items.length === 2 && (
          <div className="mt-1 flex justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex ? 'w-6 bg-amber-500' : 'w-3 bg-gray-300 dark:bg-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  // Rail view for 3+ items
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Featured</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            {items.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">
              See all →
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollRail('left')}
            className="rounded-full border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
            aria-label="Scroll featured left"
          >
            ⬅️
          </button>
          <button
            type="button"
            onClick={() => scrollRail('right')}
            className="rounded-full border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
            aria-label="Scroll featured right"
          >
            ➡️
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => handleClick(item)}
            className="group relative min-w-[280px] max-w-[280px] snap-start overflow-hidden rounded-2xl border border-amber-200/60 text-left dark:border-amber-500/30"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative h-40 w-full overflow-hidden bg-amber-50 dark:bg-amber-500/5">
              {thumbnailUrl(item) ? (
                <img
                  src={thumbnailUrl(item)!}
                  alt={item.entityName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl">⭐</div>
              )}
              <div className="absolute left-2 top-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                  ⭐ Featured
                </span>
              </div>
            </div>
            <div className="bg-white/80 p-3 dark:bg-white/[0.04]">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{item.entityName}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.brand?.name}</p>
              {formatPrice(item) && (
                <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">{formatPrice(item)}</p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default FeaturedSection;
