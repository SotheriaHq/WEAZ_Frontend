/**
 * Market section presentation: the marker beside each section title and the
 * card format a section renders in.
 *
 * The native app keeps a twin of this table in
 * `threadly-mobile/src/constants/marketSections.ts`; a contract test in that
 * repo loads both and fails if they drift, so a section looks like the same
 * place on the web and in the app.
 */

/** API layout values (`MarketSectionLayout` on the backend). */
export type MarketSectionLayoutKey =
  | 'HORIZONTAL_RAIL'
  | 'PRODUCT_GRID'
  | 'COLLECTION_RAIL'
  | 'CATEGORY_GRID'
  | 'BRAND_RAIL';

/**
 * The card format a section is drawn in.
 *
 * - `product-rail`    portrait product tiles, swiped sideways
 * - `product-grid`    portrait product tiles in a short grid (breaks the run of rails)
 * - `collection-rail` landscape collection covers, swiped sideways
 * - `brand-rail`      rounded-square brand marks
 * - `category-grid`   short label tiles in a two-up grid
 */
export type MarketSectionFormat =
  | 'product-rail'
  | 'product-grid'
  | 'collection-rail'
  | 'brand-rail'
  | 'category-grid';

const FORMAT_BY_LAYOUT: Record<MarketSectionLayoutKey, MarketSectionFormat> = {
  HORIZONTAL_RAIL: 'product-rail',
  PRODUCT_GRID: 'product-grid',
  COLLECTION_RAIL: 'collection-rail',
  BRAND_RAIL: 'brand-rail',
  CATEGORY_GRID: 'category-grid',
};

/**
 * Format for a section, from the layout the API chose, corrected by what the
 * section actually holds.
 *
 * The API layout is a promise about the section's source; the items are the
 * truth. A rail that came back holding only collections still renders as
 * collection covers, and a "collection rail" that came back holding products
 * renders as products — nothing is ever drawn in another entity's frame.
 */
export function resolveMarketSectionFormat(
  layout: string | null | undefined,
  entityTypes: ReadonlyArray<string>,
): MarketSectionFormat {
  const total = entityTypes.length;
  const count = (type: string) => entityTypes.filter((entry) => entry === type).length;
  const only = (type: string) => total > 0 && count(type) === total;

  if (only('COLLECTION')) return 'collection-rail';
  if (only('BRAND')) return 'brand-rail';
  if (only('CATEGORY')) return 'category-grid';

  const fromLayout = FORMAT_BY_LAYOUT[(layout ?? '') as MarketSectionLayoutKey];
  if (fromLayout === 'product-grid') return 'product-grid';
  if (total > 0 && count('PRODUCT') + count('DESIGN') > 0) return 'product-rail';
  return fromLayout ?? 'product-rail';
}

/**
 * One emoji per section, shown before its title (emoji markers, never icon
 * glyphs). Distinct markers give each section a landmark the eye can find
 * again on the way back up the page.
 *
 * The shopping-bags emoji is deliberately absent: it is the Bag It mark, and
 * using it as a section marker would blur what that mark means.
 */
export const MARKET_SECTION_EMOJI: Record<string, string> = {
  'hot-right-now': '🔥',
  'fresh-drops': '✨',
  'picked-for-you': '🎯',
  'new-designers-to-watch': '🌱',
  'shop-by-style': '🎨',
  'loved-near-you': '📍',
  'shop-the-look': '🧵',
  'almost-gone': '⏳',
  'still-thinking-about-these': '💭',
  'more-from-brands-you-like': '🏷️',
  'style-picks-of-the-week': '💫',
  'custom-fit': '✂️',
  'for-moodboard': '📌',
  adire: '🌀',
  'latest-collections': '🧵',
};

const EMOJI_BY_FORMAT: Record<MarketSectionFormat, string> = {
  'product-rail': '✨',
  'product-grid': '⏳',
  'collection-rail': '🧵',
  'brand-rail': '🏷️',
  'category-grid': '🎨',
};

export function getMarketSectionEmoji(key: string, format: MarketSectionFormat): string {
  return MARKET_SECTION_EMOJI[key] ?? EMOJI_BY_FORMAT[format];
}

/**
 * Vertical rhythm, in CSS pixels. Space between sections is three times the
 * space between a section's title and its cards, so each title clearly belongs
 * to the cards beneath it and not to the section above (proximity).
 */
export const MARKET_RHYTHM = {
  headerToContent: 16,
  betweenSections: 48,
} as const;
