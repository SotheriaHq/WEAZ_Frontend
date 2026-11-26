import type { MarketFacetOption, MarketFacets } from '@/api/MarketV2Api';
import {
  EMPTY_MARKET_FILTERS,
  MARKET_LIST_FILTER_KEYS,
  toggleMarketDimensionValue,
  toggleMarketListValue,
  type MarketFilters,
  type MarketListFilterKey,
} from './marketFilterState';

export interface AppliedMarketFilter {
  readonly id: string;
  readonly label: string;
  readonly remove: (filters: MarketFilters) => MarketFilters;
}

const AUDIENCE_LABELS: Record<string, string> = { MEN: 'Menswear', WOMEN: 'Womenswear', UNISEX: 'Unisex' };
const FULFILMENT_LABELS: Record<string, string> = { READY_TO_WEAR: 'Ready to wear', MADE_TO_ORDER: 'Made to order' };
const KEY_NOUNS: Record<MarketListFilterKey, string> = {
  audience: 'Audience',
  category: 'Category',
  type: 'Type',
  brand: 'Brand',
  tag: 'Tag',
  color: 'Colour',
  size: 'Size',
};

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
export const formatNaira = (amount: number) => naira.format(amount);

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${formatNaira(min)} – ${formatNaira(max)}`;
  if (min !== null) return `From ${formatNaira(min)}`;
  if (max !== null) return `Under ${formatNaira(max)}`;
  return 'Any price';
}

export function facetOptionsFor(facets: MarketFacets | null, key: MarketListFilterKey): readonly MarketFacetOption[] {
  if (!facets) return [];
  switch (key) {
    case 'audience':
      return facets.audience;
    case 'category':
      return facets.categories;
    case 'type':
      return facets.categoryTypes;
    case 'brand':
      return facets.brands;
    case 'tag':
      return facets.tags;
    case 'color':
      return facets.colors;
    case 'size':
      return facets.sizes;
    default:
      return [];
  }
}

/**
 * Each applied filter as a removable chip, labelled from the facets the
 * server sent. Identifiers without a known label fall back to their kind
 * ("Category") rather than showing a raw id.
 */
export function describeAppliedMarketFilters(
  filters: MarketFilters,
  facets: MarketFacets | null,
): AppliedMarketFilter[] {
  const applied: AppliedMarketFilter[] = [];
  for (const key of MARKET_LIST_FILTER_KEYS) {
    const options = facetOptionsFor(facets, key);
    for (const value of filters[key]) {
      const known = options.find((option) => option.value === value)?.label;
      const label =
        key === 'audience'
          ? AUDIENCE_LABELS[value] ?? value
          : known ?? (key === 'color' || key === 'size' || key === 'tag' ? value : KEY_NOUNS[key]);
      applied.push({
        id: `${key}:${value}`,
        label: key === 'size' ? `Size ${label}` : label,
        remove: (current) => toggleMarketListValue(current, key, value),
      });
    }
  }
  for (const [name, values] of Object.entries(filters.dimensions)) {
    const dimension = facets?.dimensions.find((entry) => entry.key === name);
    for (const value of values) {
      applied.push({
        id: `dim.${name}:${value}`,
        label: dimension?.values.find((option) => option.value === value)?.label ?? value,
        remove: (current) => toggleMarketDimensionValue(current, name, value),
      });
    }
  }
  if (filters.priceMin !== null || filters.priceMax !== null) {
    applied.push({
      id: 'price',
      label: formatPriceRange(filters.priceMin, filters.priceMax),
      remove: (current) => ({ ...current, priceMin: null, priceMax: null }),
    });
  }
  if (filters.onSale) applied.push({ id: 'onSale', label: 'On sale', remove: (current) => ({ ...current, onSale: false }) });
  if (filters.inStockOnly) {
    applied.push({ id: 'inStockOnly', label: 'In stock', remove: (current) => ({ ...current, inStockOnly: false }) });
  }
  if (filters.fulfilment) {
    applied.push({
      id: 'fulfilment',
      label: FULFILMENT_LABELS[filters.fulfilment] ?? filters.fulfilment,
      remove: (current) => ({ ...current, fulfilment: null }),
    });
  }
  return applied;
}

export const clearedMarketFilters = (): MarketFilters => EMPTY_MARKET_FILTERS;
export const marketAudienceLabel = (value: string) => AUDIENCE_LABELS[value] ?? value;
export const marketFulfilmentLabel = (value: string) => FULFILMENT_LABELS[value] ?? value;
