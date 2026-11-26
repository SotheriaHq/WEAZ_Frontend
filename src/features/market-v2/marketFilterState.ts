/**
 * Market filter and sort state, as it lives in the page URL.
 *
 * The URL uses the server's canonical filter vocabulary unchanged, so a shared
 * link, the browser history and the API request all say the same thing:
 *
 *   /market?audience=MEN&category=<uuid>&price.max=50000&sort=price_asc
 *
 * Parsing mirrors the server's limits (8 values per key, 24 in total, bounded
 * tokens) and drops anything the server would reject, so a hand-edited or
 * stale link degrades to fewer filters instead of a failed page. Audience
 * meaning (Menswear includes gender-neutral pieces, and so on) is decided by
 * the server; the client only carries the chosen value.
 */

export type MarketAudience = 'MEN' | 'WOMEN' | 'UNISEX';
export type MarketFulfilment = 'READY_TO_WEAR' | 'MADE_TO_ORDER';

export const MARKET_SORTS = [
  'newest',
  'popular',
  'trending',
  'price_asc',
  'price_desc',
  'best_selling',
  'most_saved',
] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];

export type MarketListFilterKey = 'audience' | 'category' | 'type' | 'brand' | 'tag' | 'color' | 'size';

export interface MarketFilters {
  readonly audience: readonly MarketAudience[];
  readonly category: readonly string[];
  readonly type: readonly string[];
  readonly brand: readonly string[];
  readonly tag: readonly string[];
  readonly color: readonly string[];
  readonly size: readonly string[];
  /** Collection dimensions (`dim.<slug>`), e.g. occasion or fabric. */
  readonly dimensions: Readonly<Record<string, readonly string[]>>;
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly onSale: boolean;
  readonly inStockOnly: boolean;
  readonly fulfilment: MarketFulfilment | null;
}

export interface MarketUrlState {
  readonly filters: MarketFilters;
  readonly sort: MarketSort | null;
}

export const MARKET_FILTER_LIMITS = {
  valuesPerKey: 8,
  valuesTotal: 24,
  tokenCharacters: 120,
  priceMax: 99_999_999.99,
} as const;

export const MARKET_LIST_FILTER_KEYS: readonly MarketListFilterKey[] = [
  'audience',
  'category',
  'type',
  'brand',
  'tag',
  'color',
  'size',
];

const SCALAR_KEYS = ['price.min', 'price.max', 'onSale', 'inStockOnly', 'fulfilment'] as const;
const AUDIENCES: readonly MarketAudience[] = ['MEN', 'WOMEN', 'UNISEX'];
const FULFILMENTS: readonly MarketFulfilment[] = ['READY_TO_WEAR', 'MADE_TO_ORDER'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
/** Canonical tag form accepted by the server: 2–24 of a-z, 0-9, dot, dash, underscore. */
const TAG = /^[a-z0-9._-]{2,24}$/;
// The server accepts a signed zero; every other negative amount is refused below.
const MONEY = /^-?\d{1,8}(?:\.\d{1,2})?$/;
// Control characters are never a meaningful filter value.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f�]/u;

export const EMPTY_MARKET_FILTERS: MarketFilters = Object.freeze({
  audience: [],
  category: [],
  type: [],
  brand: [],
  tag: [],
  color: [],
  size: [],
  dimensions: {},
  priceMin: null,
  priceMax: null,
  onSale: false,
  inStockOnly: false,
  fulfilment: null,
});

const cleanToken = (raw: string): string | null => {
  if (CONTROL.test(raw)) return null;
  const value = raw.normalize('NFKC').trim();
  if (!value || [...value].length > MARKET_FILTER_LIMITS.tokenCharacters) return null;
  return value;
};

const normalizeListValue = (key: MarketListFilterKey | 'dimension', raw: string): string | null => {
  const value = cleanToken(raw);
  if (value === null) return null;
  switch (key) {
    case 'audience': {
      const audience = value.toUpperCase();
      return (AUDIENCES as readonly string[]).includes(audience) ? audience : null;
    }
    case 'category':
    case 'type':
    case 'brand': {
      const id = value.toLowerCase();
      return UUID.test(id) ? id : null;
    }
    case 'tag': {
      const tag = value.replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
      return TAG.test(tag) ? tag : null;
    }
    case 'dimension': {
      const slug = value.toLowerCase();
      return SLUG.test(slug) ? slug : null;
    }
    case 'color':
      return /^[\x20-\x7e]+$/.test(value) ? value.toLowerCase() : value;
    default:
      return value;
  }
};

const parseMoney = (raw: string | null): number | null => {
  if (raw === null) return null;
  const value = raw.trim();
  if (!MONEY.test(value)) return null;
  const parsed = Number(value);
  const amount = parsed === 0 ? 0 : parsed;
  return Number.isFinite(amount) && amount >= 0 && amount <= MARKET_FILTER_LIMITS.priceMax
    ? amount
    : null;
};

const parseToggle = (raw: string | null): boolean => raw === '1' || raw === 'true';

const readListParam = (params: URLSearchParams, key: string): string[] => {
  const bracket = params.getAll(`${key}[]`);
  if (bracket.length > 0) return bracket;
  const csv = params.getAll(key);
  // A repeated CSV key is ambiguous to the server; keep the first occurrence.
  return csv.length > 0 ? csv[0].split(',') : [];
};

const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * Read the filter and sort state from a URL query.
 *
 * Unknown keys (including other features' parameters) are ignored, never
 * forwarded; invalid values are dropped. `dropped` reports whether anything
 * Market-related had to be discarded so the page can tell the shopper.
 */
export function parseMarketUrlState(params: URLSearchParams): MarketUrlState & { dropped: boolean } {
  let dropped = false;
  let total = 0;
  const take = (key: MarketListFilterKey | 'dimension', raws: string[]): string[] => {
    const accepted: string[] = [];
    for (const raw of raws) {
      const value = normalizeListValue(key, raw);
      if (value === null) {
        dropped = true;
        continue;
      }
      if (accepted.includes(value)) continue;
      if (accepted.length >= MARKET_FILTER_LIMITS.valuesPerKey || total >= MARKET_FILTER_LIMITS.valuesTotal) {
        dropped = true;
        continue;
      }
      accepted.push(value);
      total += 1;
    }
    return sortedUnique(accepted);
  };

  const lists = {} as Record<MarketListFilterKey, string[]>;
  for (const key of MARKET_LIST_FILTER_KEYS) lists[key] = take(key, readListParam(params, key));

  const dimensionNames = sortedUnique(
    [...params.keys()]
      .filter((key) => key.startsWith('dim.'))
      .map((key) => key.replace(/\[\]$/, '').slice(4)),
  );
  const dimensions: Record<string, readonly string[]> = {};
  for (const name of dimensionNames) {
    if (!SLUG.test(name)) {
      dropped = true;
      continue;
    }
    const values = take('dimension', readListParam(params, `dim.${name}`));
    if (values.length > 0) dimensions[name] = values;
  }

  const rawMin = params.get('price.min');
  const rawMax = params.get('price.max');
  let priceMin = parseMoney(rawMin);
  let priceMax = parseMoney(rawMax);
  if ((rawMin !== null && priceMin === null) || (rawMax !== null && priceMax === null)) dropped = true;
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    priceMin = null;
    priceMax = null;
    dropped = true;
  }

  const rawFulfilment = params.get('fulfilment');
  const fulfilmentValue = rawFulfilment?.trim().toUpperCase() ?? null;
  let fulfilment = fulfilmentValue && (FULFILMENTS as readonly string[]).includes(fulfilmentValue)
    ? (fulfilmentValue as MarketFulfilment)
    : null;
  if (rawFulfilment !== null && fulfilment === null && fulfilmentValue !== 'ANY') dropped = true;

  // The server counts scalar controls against the same total as list values.
  let onSale = parseToggle(params.get('onSale'));
  let inStockOnly = parseToggle(params.get('inStockOnly'));
  const fits = (present: boolean): boolean => {
    if (!present) return false;
    if (total >= MARKET_FILTER_LIMITS.valuesTotal) {
      dropped = true;
      return false;
    }
    total += 1;
    return true;
  };
  if (!fits(priceMin !== null)) priceMin = null;
  if (!fits(priceMax !== null)) priceMax = null;
  onSale = fits(onSale);
  inStockOnly = fits(inStockOnly);
  if (!fits(fulfilment !== null)) fulfilment = null;

  const rawSort = params.get('sort');
  const sort = rawSort && (MARKET_SORTS as readonly string[]).includes(rawSort) ? (rawSort as MarketSort) : null;
  if (rawSort !== null && sort === null) dropped = true;

  const filters: MarketFilters = {
    audience: lists.audience as MarketAudience[],
    category: lists.category,
    type: lists.type,
    brand: lists.brand,
    tag: lists.tag,
    color: lists.color,
    size: lists.size,
    dimensions,
    priceMin,
    priceMax,
    onSale,
    inStockOnly,
    fulfilment,
  };
  return { filters, sort, dropped };
}

const appendList = (params: URLSearchParams, key: string, values: readonly string[]) => {
  if (values.length === 0) return;
  // The server's CSV form cannot carry a comma inside a value (size labels
  // such as "8,5" do); those lists use the bracket form instead.
  if (values.some((value) => value.includes(','))) {
    for (const value of values) params.append(`${key}[]`, value);
  } else {
    params.set(key, values.join(','));
  }
};

const formatMoney = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

/** Canonical wire form of the filters, identical for the URL and the API. */
export function marketFiltersToParams(filters: MarketFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of MARKET_LIST_FILTER_KEYS) appendList(params, key, sortedUnique(filters[key]));
  for (const name of Object.keys(filters.dimensions).sort()) {
    appendList(params, `dim.${name}`, sortedUnique(filters.dimensions[name] ?? []));
  }
  if (filters.priceMin !== null) params.set('price.min', formatMoney(filters.priceMin));
  if (filters.priceMax !== null) params.set('price.max', formatMoney(filters.priceMax));
  if (filters.onSale) params.set('onSale', '1');
  if (filters.inStockOnly) params.set('inStockOnly', '1');
  if (filters.fulfilment) params.set('fulfilment', filters.fulfilment);
  return params;
}

const isMarketParam = (key: string) =>
  key === 'sort' ||
  key.startsWith('dim.') ||
  (SCALAR_KEYS as readonly string[]).includes(key) ||
  MARKET_LIST_FILTER_KEYS.some((list) => key === list || key === `${list}[]`);

/**
 * Write the state into a query, keeping every unrelated parameter (for
 * example `parent` on a See All page) exactly as it was.
 */
export function serializeMarketUrlState(state: MarketUrlState, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  if (base) {
    for (const [key, value] of base) if (!isMarketParam(key)) next.append(key, value);
  }
  for (const [key, value] of marketFiltersToParams(state.filters)) next.append(key, value);
  if (state.sort) next.set('sort', state.sort);
  return next;
}

/** Stable identity for query keys: equal filters always produce equal strings. */
export const marketFiltersKey = (filters: MarketFilters): string => marketFiltersToParams(filters).toString();

export function countActiveMarketFilters(filters: MarketFilters): number {
  let count = 0;
  for (const key of MARKET_LIST_FILTER_KEYS) count += filters[key].length;
  for (const values of Object.values(filters.dimensions)) count += values.length;
  if (filters.priceMin !== null || filters.priceMax !== null) count += 1;
  if (filters.onSale) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.fulfilment) count += 1;
  return count;
}

export const hasActiveMarketFilters = (filters: MarketFilters): boolean => countActiveMarketFilters(filters) > 0;

/** Values as the server counts them: every list value and every scalar control. */
const totalFilterValues = (filters: MarketFilters): number => {
  let total = 0;
  for (const key of MARKET_LIST_FILTER_KEYS) total += filters[key].length;
  for (const values of Object.values(filters.dimensions)) total += values.length;
  if (filters.priceMin !== null) total += 1;
  if (filters.priceMax !== null) total += 1;
  if (filters.onSale) total += 1;
  if (filters.inStockOnly) total += 1;
  if (filters.fulfilment) total += 1;
  return total;
};

/** Whether another value can be added without the server refusing the request. */
export const canAddMarketFilterValue = (filters: MarketFilters): boolean =>
  totalFilterValues(filters) < MARKET_FILTER_LIMITS.valuesTotal;

/**
 * Add or remove one value of a list filter. Adding beyond the server's limits
 * is refused (the same filters come back), so the UI never builds a request
 * the server would reject.
 */
export function toggleMarketListValue(
  filters: MarketFilters,
  key: MarketListFilterKey,
  value: string,
): MarketFilters {
  const current = filters[key] as readonly string[];
  if (current.includes(value)) {
    return { ...filters, [key]: current.filter((entry) => entry !== value) };
  }
  const normalized = normalizeListValue(key, value);
  if (
    normalized === null ||
    current.length >= MARKET_FILTER_LIMITS.valuesPerKey ||
    !canAddMarketFilterValue(filters)
  ) {
    return filters;
  }
  return { ...filters, [key]: sortedUnique([...current, normalized]) };
}

/**
 * Add or remove one style detail. A single-choice detail (`isMulti: false`)
 * swaps its value, because the server refuses two values for it.
 */
export function toggleMarketDimensionValue(
  filters: MarketFilters,
  name: string,
  value: string,
  isMulti = true,
): MarketFilters {
  const current = filters.dimensions[name] ?? [];
  const dimensions = { ...filters.dimensions };
  if (current.includes(value)) {
    const remaining = current.filter((entry) => entry !== value);
    if (remaining.length > 0) dimensions[name] = remaining;
    else delete dimensions[name];
    return { ...filters, dimensions };
  }
  const normalized = normalizeListValue('dimension', value);
  if (
    normalized === null ||
    !SLUG.test(name) ||
    (isMulti && current.length >= MARKET_FILTER_LIMITS.valuesPerKey) ||
    ((isMulti || current.length === 0) && !canAddMarketFilterValue(filters))
  ) {
    return filters;
  }
  dimensions[name] = isMulti ? sortedUnique([...current, normalized]) : [normalized];
  return { ...filters, dimensions };
}

/** Validates a typed price range; returns null when it cannot be sent. */
export function withMarketPriceRange(
  filters: MarketFilters,
  minRaw: string,
  maxRaw: string,
): MarketFilters | null {
  const min = minRaw.trim() === '' ? null : parseMoney(minRaw.replace(/[,\s₦]/g, ''));
  const max = maxRaw.trim() === '' ? null : parseMoney(maxRaw.replace(/[,\s₦]/g, ''));
  if ((minRaw.trim() !== '' && min === null) || (maxRaw.trim() !== '' && max === null)) return null;
  if (min !== null && max !== null && min > max) return null;
  return { ...filters, priceMin: min, priceMax: max };
}

export const marketUrlStatesEqual = (a: MarketUrlState, b: MarketUrlState): boolean =>
  a.sort === b.sort && marketFiltersKey(a.filters) === marketFiltersKey(b.filters);
