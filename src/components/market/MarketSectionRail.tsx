import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketSection, MarketSectionItem, MarketSignalEvent } from '@/api/MarketApi';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import {
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';
import { StoreProductCard } from '@/components/designs/StoreProductCard';
import {
  MarketBrandTile,
  MarketCategoryTile,
  MarketCollectionCard,
  MarketItemTile,
} from '@/components/market/MarketEntityCards';
import {
  getMarketSectionEmoji,
  resolveMarketSectionFormat,
  type MarketSectionFormat,
} from '@/constants/marketSections';

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

/** Width of one card in a sideways rail, per format. The phone widths leave
 *  part of the next card showing, which is what tells a thumb the row scrolls. */
const RAIL_ITEM_WIDTH: Partial<Record<MarketSectionFormat, string>> = {
  'product-rail': 'w-[calc((100%-1.75rem)/2.3)] sm:w-[220px] lg:w-[236px]',
  'collection-rail': 'w-[82%] sm:w-[360px] lg:w-[400px]',
  'brand-rail': 'w-[104px] sm:w-[128px]',
};

/**
 * Every section has a fixed height, however much it holds.
 *
 * More items make a section LONGER SIDEWAYS, never taller: rails are one row
 * and the grid formats are two rows, all scrolled inline. A brand with three
 * hundred pieces and a brand with six take the same space on the page, so the
 * sections below never get pushed out of reach. Scrolling is snapped and
 * momentum-driven, with no scrollbar, no tap highlight and no focus ring for
 * touch or mouse (keyboard focus still shows, for those who need it).
 */
const SCROLLER_BASE =
  'snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-2 pt-1 outline-none [-webkit-overflow-scrolling:touch] [-webkit-tap-highlight-color:transparent] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const SCROLLER_LAYOUT: Record<MarketSectionFormat, string> = {
  'product-rail': 'flex gap-3.5 sm:gap-4',
  'collection-rail': 'flex gap-3.5 sm:gap-4',
  'brand-rail': 'flex gap-2 sm:gap-3',
  // Two rows that scroll sideways — a different rhythm from the one-row rails
  // around it, at a fixed two-card height.
  'product-grid':
    'grid grid-flow-col grid-rows-2 auto-cols-[calc((100%-1.75rem)/2.3)] gap-3.5 sm:auto-cols-[220px] sm:gap-4 lg:auto-cols-[236px]',
  'category-grid':
    'grid grid-flow-col grid-rows-2 auto-cols-[calc((100%-0.75rem)/2.15)] gap-3 sm:auto-cols-[240px] sm:gap-4',
};

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

  const format = useMemo(
    () => resolveMarketSectionFormat(section.layout, items.map((item) => item.entityType)),
    [items, section.layout],
  );

  const checkScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll, { passive: true });
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, items.length]);

  const scrollBy = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.8), behavior: 'smooth' });
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

  const trackOpen = (item: MarketSectionItem, position: number) => {
    const targetId = getSectionItemTargetId(item);
    if (!targetId) return;
    onTrackSignal({
      targetType: item.entityType,
      targetId,
      signalType: 'OPEN',
      surface: 'MARKET_HOME',
      sectionKey: section.key,
      position,
    });
  };

  if (!items || items.length === 0) return null;

  const emoji = getMarketSectionEmoji(section.key, format);
  const label = eyebrow || section.emotionalLabel || null;

  const renderItem = (item: MarketSectionItem, index: number) => {
    const key = `${section.key}-${item.sourceType}-${item.sourceId}-${index}`;
    const open = (entry: MarketSectionItem) => {
      trackOpen(entry, index);
      onOpenItem(entry);
    };

    if (format === 'collection-rail') {
      return (
        <MarketCollectionCard
          key={key}
          item={item}
          onOpen={open}
          className={`shrink-0 snap-start ${RAIL_ITEM_WIDTH[format]}`}
        />
      );
    }
    if (format === 'brand-rail') {
      return (
        <MarketBrandTile
          key={key}
          item={item}
          onOpen={open}
          className={`shrink-0 snap-start ${RAIL_ITEM_WIDTH[format]}`}
        />
      );
    }
    if (format === 'category-grid') {
      return <MarketCategoryTile key={key} item={item} onOpen={open} className="snap-start" />;
    }

    const widthClass =
      format === 'product-rail' ? `shrink-0 snap-start ${RAIL_ITEM_WIDTH[format]}` : 'snap-start';
    const product = mapSectionProductToMarketplaceProduct(item);
    if (product) {
      return (
        <div key={key} className={widthClass}>
          <StoreProductCard
            product={product}
            priority={index < 2}
            onViewProduct={() => {
              trackOpen(item, index);
              onViewProduct(product);
            }}
          />
        </div>
      );
    }
    return (
      <div key={key} className={widthClass}>
        <MarketItemTile item={item} onOpen={open} />
      </div>
    );
  };

  const header = (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {label ? (
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-purple-600 dark:text-purple-300">
            {label}
          </p>
        ) : null}
        <h2 className="mt-1 flex min-w-0 items-center gap-2 text-lg font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          <span aria-hidden="true" className="shrink-0">{emoji}</span>
          <span className="truncate">{title}</span>
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={handleExplore}
          className="rounded-full px-1 text-xs font-bold text-purple-700 underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300 sm:text-sm"
          aria-label={`See all ${title}`}
        >
          See all ›
        </button>

        {canScrollLeft || canScrollRight ? (
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} left`}
              className="wiez-lg-surface wiez-lg-subtle wiez-lg-interactive flex h-8 w-8 items-center justify-center rounded-full text-sm disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={!canScrollRight}
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} right`}
              className="wiez-lg-surface wiez-lg-subtle wiez-lg-interactive flex h-8 w-8 items-center justify-center rounded-full text-sm disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  const isTwoRow = format === 'product-grid' || format === 'category-grid';
  const body = (
    <div ref={scrollerRef} onScroll={checkScroll} className={`${SCROLLER_BASE} ${SCROLLER_LAYOUT[format]}`}>
      {items.map(renderItem)}
      <button
        type="button"
        onClick={handleExplore}
        className={`group flex shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 p-4 text-center outline-none transition-colors hover:bg-purple-50 focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-white/[0.04] dark:hover:bg-purple-950/30 ${
          isTwoRow ? 'row-span-2' : format === 'brand-rail' ? 'w-[104px] sm:w-[128px]' : 'w-[132px] sm:w-[168px]'
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-lg font-bold text-white transition-transform group-hover:scale-105 dark:bg-white dark:text-gray-900">
          →
        </span>
        <span className="text-xs font-bold text-gray-900 dark:text-white">See all</span>
      </button>
    </div>
  );

  /*
    Collections sit on their own tinted band — a common region — because they
    are a different kind of thing from the product rails around them (a group
    of pieces, not one piece). The band marks that change before a single card
    is read, and it breaks the page into chunks the eye can count.
  */
  if (format === 'collection-rail') {
    return (
      <section
        className="-mx-4 space-y-4 bg-purple-50/70 px-4 py-6 dark:bg-white/[0.035] sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-3xl"
        aria-label={title}
      >
        {header}
        {body}
      </section>
    );
  }

  return (
    <section className="w-full space-y-4" aria-label={title}>
      {header}
      {body}
    </section>
  );
};

export default MarketSectionRail;
