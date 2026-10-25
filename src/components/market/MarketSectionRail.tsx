import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { CLIP_EMOJI, clipActionLabel } from '@/constants/clipping';
import { useClipTarget, type ClipTargetType } from '@/features/clipping/useClipTarget';
import { useSavedStatusQuery } from '@/query/queries';
import type { MarketSection, MarketSectionItem, MarketSignalEvent } from '@/api/MarketApi';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import {
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';
import { useBagging } from '@/hooks/useBagging';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const formatPrice = (amount?: number | null): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Price on request';
  return currency.format(amount);
};

const SectionItemCard: React.FC<{
  item: MarketSectionItem;
  product: MarketplaceProduct | null;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onOpenItem: (item: MarketSectionItem) => void;
  onTrackOpen: () => void;
}> = ({ item, product, onOpenProduct, onOpenItem, onTrackOpen }) => {
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);
  const profile = useSelector((state: RootState) => state.user.profile);
  const userBrandId = profile?.storeId || profile?.activeBrandId;
  const isOwnBrand = Boolean(userBrandId && product?.brandId === userBrandId);

  const { bagProduct, loadingByProductId, getPulseStatus } = useBagging();
  const isBagging = product ? Boolean(loadingByProductId[product.id]) : false;
  const pulseStatus = product ? getPulseStatus(product.id) : 'not_bagged';

  const { toggleClip } = useClipTarget();
  const targetId = getSectionItemTargetId(item);
  const statusQuery = useSavedStatusQuery(item.entityType, targetId);
  const clipped = statusQuery.data === true;

  const mediaUrl =
    item.media?.url ||
    item.media?.thumbnailUrl ||
    product?.thumbnail ||
    product?.images?.[0] ||
    null;

  const isCustomFit = Boolean(
    product?.isCustomOrderOnly || product?.customAvailable || product?.customOrderEnabled,
  );
  const isOutOfStock = Boolean(product?.isOutOfStock && !product?.canBagWhenOutOfStock);

  const badgeText = useMemo(() => {
    if (isOutOfStock) return 'ARCHIVE DROP • SOLD OUT';
    if (isCustomFit) return '+ CUSTOM FIT';
    return 'READY TO WEAR';
  }, [isCustomFit, isOutOfStock]);

  const badgeStyle = useMemo(() => {
    if (isOutOfStock) {
      return 'bg-gray-900/80 text-white/90 border-white/20';
    }
    if (isCustomFit) {
      return 'bg-[#2a173d]/90 text-purple-200 border-purple-400/30';
    }
    return 'bg-black/60 text-white/90 border-white/20';
  }, [isCustomFit, isOutOfStock]);

  const handleCardClick = () => {
    onTrackOpen();
    if (product) {
      onOpenProduct(product);
    } else {
      onOpenItem(item);
    }
  };

  const handleBagClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product) {
      handleCardClick();
      return;
    }
    if (isOwnBrand) {
      toast.info('Brands cannot bag their own products.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to bag items.');
      return;
    }
    if (isOutOfStock) {
      toast.info('This piece is currently sold out.');
      return;
    }
    if (isCustomFit) {
      onOpenProduct(product);
      return;
    }

    try {
      await bagProduct({ id: product.id, name: product.name });
    } catch {
      toast.error('Failed to bag item. Try again.');
    }
  };

  const handleClipToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!targetId) return;
    if (
      item.entityType === 'PRODUCT' ||
      item.entityType === 'DESIGN' ||
      item.entityType === 'COLLECTION'
    ) {
      void toggleClip({ targetType: item.entityType as ClipTargetType, targetId, clipped });
    }
  };

  const brandOrigin = useMemo(() => {
    const brandName = item.brand?.name || product?.brand?.name || 'WIEZ ATELIER';
    return `${brandName.toUpperCase()} STUDIO • ABUJA & LAGOS`;
  }, [item.brand?.name, product?.brand?.name]);

  const priceAmount =
    item.price?.effectiveAmount ||
    item.price?.amount ||
    product?.effectivePrice ||
    product?.price ||
    null;

  return (
    <article
      onClick={handleCardClick}
      className="group flex w-[280px] sm:w-[320px] shrink-0 cursor-pointer flex-col select-none transition-all duration-300"
    >
      {/* ── Top Media Frame (Image 2 Parity) ── */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gray-200/60 bg-[#171220]/5 transition duration-300 dark:border-white/10 dark:bg-white/[0.03]">
        <ImageWithFallback
          src={mediaUrl}
          alt={item.title}
          fit="cover"
          rounded="none"
          containerClassName="h-full w-full bg-purple-50/20 dark:bg-white/5"
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          fallbackName={item.title}
        />

        {/* Top Badges & Clip Button */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] backdrop-blur-md ${badgeStyle}`}
          >
            {badgeText}
          </span>

          <button
            type="button"
            onClick={handleClipToggle}
            aria-pressed={clipped}
            aria-label={clipActionLabel(clipped)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm backdrop-blur-md transition hover:scale-110 active:scale-95 ${
              clipped
                ? 'bg-[color:var(--text-primary)] text-[color:var(--surface-primary)]'
                : 'bg-black/35 text-white/90 border border-white/20 hover:bg-black/55'
            }`}
          >
            <span aria-hidden="true">{CLIP_EMOJI}</span>
          </button>
        </div>

        {/* Bottom Scrim & Action Button Over Photo */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-12">
          <button
            type="button"
            onClick={handleBagClick}
            disabled={isBagging}
            className={`w-full rounded-2xl py-2.5 text-xs font-bold uppercase tracking-wider transition duration-200 active:scale-95 flex items-center justify-center gap-1.5 ${
              isOutOfStock
                ? 'bg-gray-800/90 text-white/80 hover:bg-gray-700'
                : isCustomFit
                  ? 'bg-[color:var(--text-primary)] hover:opacity-90 text-[color:var(--surface-primary)]'
                  : 'bg-white hover:bg-gray-100 text-gray-900'
            }`}
          >
            {!isOutOfStock && !isCustomFit && (
              <BagPulseIcon size={16} status={pulseStatus} />
            )}
            <span>
              {isOutOfStock
                ? 'NOTIFY NEXT RUN'
                : isCustomFit
                  ? 'CUSTOMIZE FIT'
                  : 'ADD TO BAG'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Metadata Area Below Card (Image 2 Parity) ── */}
      <div className="mt-3 flex flex-col gap-1 px-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 truncate">
          {brandOrigin}
        </p>

        <h3 className="font-serif text-sm sm:text-base font-medium leading-snug text-gray-900 dark:text-white line-clamp-2 transition group-hover:text-purple-600 dark:group-hover:text-purple-400">
          {item.title}
        </h3>

        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
            {formatPrice(priceAmount)}
          </span>

          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400/90">
            {isOutOfStock ? 'Waitlist Open (Atelier Queue)' : 'In Stock • Ready'}
          </span>
        </div>
      </div>
    </article>
  );
};

export interface MarketSectionRailProps {
  section: MarketSection;
  eyebrow?: string;
  title: string;
  items: MarketSectionItem[];
  onViewProduct: (product: MarketplaceProduct) => void;
  onOpenItem: (item: MarketSectionItem) => void;
  onTrackSignal: (event: MarketSignalEvent) => void;
  onExploreSection: (sectionKey: string, title: string) => void;
}

export const MarketSectionRail: React.FC<MarketSectionRailProps> = ({
  section,
  eyebrow,
  title,
  items,
  onViewProduct,
  onOpenItem,
  onTrackSignal,
  onExploreSection,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (!scrollerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, items.length]);

  const scrollBy = (offset: number) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  const handleExplore = () => {
    onTrackSignal({
      targetType: 'SECTION',
      targetId: section.key,
      signalType: 'VIEW_ALL_CLICK',
      surface: 'MARKET_HOME',
      sectionKey: section.key,
    });
    onExploreSection(section.key, title);
  };

  if (!items || items.length === 0) return null;

  const displayEyebrow = eyebrow || section.emotionalLabel || 'HANDPICKED SILHOUETTES';
  const exploreLabel = `Explore ${title} →`;

  return (
    <section className="w-full space-y-4 py-2">
      {/* ── Section Header with Eyebrow, Title, Arrows, and Explore Link (Image 2 Parity) ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--brand-primary,#9333EA)]">
            {displayEyebrow}
          </p>
          <h2 className="mt-0.5 font-serif text-xl sm:text-2xl lg:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>

        {/* Right Controls: Arrow Carousel Navigation & Explore Destination Link */}
        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExplore}
            className="rounded-full text-xs sm:text-sm font-serif font-semibold text-[color:var(--brand-primary,#9333EA)] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            {exploreLabel}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-360)}
              aria-label={`Scroll ${title} left`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 active:scale-95"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={!canScrollRight}
              onClick={() => scrollBy(360)}
              aria-label={`Scroll ${title} right`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 active:scale-95"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable Rail Container (Smooth Scroll Snap) ── */}
      <div
        ref={scrollerRef}
        onScroll={checkScroll}
        className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 pt-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => {
          const product = mapSectionProductToMarketplaceProduct(item);
          const targetId = getSectionItemTargetId(item);
          const trackOpen = () => {
            if (targetId) {
              onTrackSignal({
                targetType: item.entityType,
                targetId,
                signalType: 'OPEN',
                surface: 'MARKET_HOME',
                sectionKey: section.key,
                position: index,
              });
            }
          };

          return (
            <SectionItemCard
              key={`${section.key}-${item.sourceType}-${item.sourceId}-${index}`}
              item={item}
              product={product}
              onOpenProduct={onViewProduct}
              onOpenItem={onOpenItem}
              onTrackOpen={trackOpen}
            />
          );
        })}

        {/* ── End-of-Rail Explore / View More Card ── */}
        <div
          onClick={handleExplore}
          className="group relative flex w-[200px] sm:w-[220px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300/80 bg-gradient-to-b from-stone-50/60 to-stone-100/80 p-5 text-center transition-all duration-300 hover:border-purple-500 hover:bg-purple-50/30 hover:shadow-md dark:border-white/15 dark:from-white/[0.02] dark:to-white/[0.05] dark:hover:border-purple-400 dark:hover:bg-purple-950/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:bg-purple-600 dark:bg-white dark:text-gray-900">
            <span className="text-xl leading-none font-bold">→</span>
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
            Sector Archive
          </p>
          <h4 className="mt-1 font-serif text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
            Explore All {title}
          </h4>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            View full edit & custom fits
          </p>
        </div>
      </div>
    </section>
  );
};

export default MarketSectionRail;
