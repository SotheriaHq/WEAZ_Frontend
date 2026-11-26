import type { MarketSectionFormat } from '@/constants/marketSections';

/** Width of one card in a sideways rail, per format. The phone widths leave
 *  part of the next card showing, which is what tells a thumb the row scrolls. */
export const RAIL_ITEM_WIDTH: Partial<Record<MarketSectionFormat, string>> = {
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
export const SCROLLER_BASE =
  'snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-2 pt-1 outline-none [-webkit-overflow-scrolling:touch] [-webkit-tap-highlight-color:transparent] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const SCROLLER_LAYOUT: Record<MarketSectionFormat, string> = {
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
