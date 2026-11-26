import React, { memo, useCallback, useMemo } from 'react';
import type { MarketV2Item } from '@/api/MarketV2Api';
import type { MarketSectionFormat } from '@/constants/marketSections';
import { StoreProductCard } from '@/components/designs/StoreProductCard';
import {
  formatMarketItemPrice,
  MarketBrandTile,
  MarketCategoryTile,
  MarketCollectionCard,
  MarketItemTile,
} from '@/components/market/MarketEntityCards';
import { mapSectionProductToMarketplaceProduct } from '@/utils/marketSectionMapper';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import { marketItemHref, marketItemLabel } from '@/features/market-v2/marketItemRoutes';

export type MarketCardOpen = (item: MarketV2Item, index: number, product: MarketplaceProduct | null) => void;

export interface MarketCardCellProps {
  item: MarketV2Item;
  index: number;
  format: MarketSectionFormat;
  className?: string;
  /** Ref factory from `useMarketImpressions`. */
  observe: (item: MarketV2Item, index: number) => (node: Element | null) => (() => void) | undefined;
  onOpen: MarketCardOpen;
  /** Roving tab stop inside a rail; grids leave every card reachable. */
  tabIndex?: 0 | -1;
  onCardFocus?: (index: number) => void;
  priority?: boolean;
}

/**
 * One Market card with a single keyboard target.
 *
 * Cards are drawn by the shared card components (photo frame and Bag It
 * unchanged). Their roots are not focusable, so a link covering the card gives
 * keyboard and screen-reader users one stop with a composed label
 * ("{name} by {brand}, {price}"). It ignores the pointer, so mouse and touch
 * reach the card and its own buttons exactly as before. Brand and category
 * tiles are buttons already and need no cover.
 */
function MarketCardCellImpl({
  item,
  index,
  format,
  className = '',
  observe,
  onOpen,
  tabIndex,
  onCardFocus,
  priority = false,
}: MarketCardCellProps) {
  // Mapping once per item keeps the card's props stable across re-renders, so
  // the card never re-resolves its images.
  const product = useMemo(() => mapSectionProductToMarketplaceProduct(item), [item]);
  const ref = useMemo(() => observe(item, index), [observe, item, index]);
  const open = useCallback(() => onOpen(item, index, product), [index, item, onOpen, product]);

  const coverable = format !== 'brand-rail' && format !== 'category-grid';
  const href = coverable ? marketItemHref(item) : null;
  const label = marketItemLabel(item, formatMarketItemPrice(item));

  let card: React.ReactNode;
  if (format === 'collection-rail') card = <MarketCollectionCard item={item} onOpen={open} />;
  else if (format === 'brand-rail') card = <MarketBrandTile item={item} onOpen={open} className="w-full" />;
  else if (format === 'category-grid') card = <MarketCategoryTile item={item} onOpen={open} />;
  else if (product) card = <StoreProductCard product={product} priority={priority} onViewProduct={open} />;
  else card = <MarketItemTile item={item} onOpen={open} />;

  return (
    <div ref={ref} data-market-cell="" className={`relative ${className}`}>
      {href ? (
        <a
          href={href}
          data-market-card=""
          tabIndex={tabIndex}
          aria-label={label}
          onFocus={() => onCardFocus?.(index)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            open();
          }}
          className="pointer-events-none absolute inset-0 z-30 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--wiez-border-focus)]"
        />
      ) : null}
      {card}
    </div>
  );
}

export const MarketCardCell = memo(MarketCardCellImpl);
export default MarketCardCell;
