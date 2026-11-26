import { isAxiosError } from 'axios';
import { apiClient } from './httpClient';
import {
  normalizeMarketSectionDetailResponse,
  type MarketSectionDetailResponse,
  type MarketSectionItem,
  type MarketSectionLayout,
  type MarketSectionSourceType,
} from './MarketApi';
import {
  MARKET_SORTS,
  marketFiltersToParams,
  type MarketFilters,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import type { MarketListNotice, MarketListPage } from '@/features/market-v2/mergeMarketPages';
import { stableMarketMediaUrl } from '@/features/market-v2/marketMediaIdentity';

/**
 * Client for the server-composed Market (`/market/page`, `/market/catalog`,
 * `/market/sections/:key`, `/market/facets`).
 *
 * Every response is parsed defensively: malformed items are dropped one by
 * one, and a payload whose overall shape is wrong raises
 * `MarketV2ContractError` so the page can fall back to the established Market
 * instead of rendering half a contract. Server order is preserved exactly.
 */

export class MarketV2ContractError extends Error {
  constructor(endpoint: string) {
    super(`The Market response from ${endpoint} did not match its contract.`);
    this.name = 'MarketV2ContractError';
  }
}

export type MarketV2ErrorKind =
  | 'unavailable'
  | 'contract'
  | 'invalid-cursor'
  | 'invalid-filter'
  | 'unsupported-sort'
  | 'rate-limited'
  | 'busy'
  | 'network'
  | 'server';

/** What went wrong, in the terms the screens act on. */
export function marketV2ErrorKind(error: unknown): MarketV2ErrorKind {
  if (error instanceof MarketV2ContractError) return 'contract';
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response) return 'network';
    if (status === 404) return 'unavailable';
    if (status === 503) return 'busy';
    if (status === 429) return 'rate-limited';
    const code = (error.response.data as { code?: unknown } | undefined)?.code;
    if (status === 400) {
      if (code === 'INVALID_CURSOR') return 'invalid-cursor';
      if (code === 'UNSUPPORTED_SORT') return 'unsupported-sort';
      return 'invalid-filter';
    }
  }
  return 'server';
}

/**
 * The server cannot serve the composed Market: it is switched off (404),
 * refused the read (503) or answered outside its contract. A first load that
 * ends this way shows the established Market instead.
 */
export const shouldFallBackToClassicMarket = (error: unknown): boolean => {
  const kind = marketV2ErrorKind(error);
  return kind === 'unavailable' || kind === 'contract' || kind === 'busy';
};

/**
 * Retry only failures an immediate second attempt can fix. A 503 is not one:
 * the server is shedding load, and repeating the request adds to it.
 */
export const retryMarketV2Request = (failureCount: number, error: unknown): boolean => {
  const kind = marketV2ErrorKind(error);
  return (kind === 'network' || kind === 'server') && failureCount < 1;
};

export interface MarketFacetOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
  readonly disabled: boolean;
  /** The category a garment type belongs to, when the server sends it. */
  readonly categoryId: string | null;
}

export interface MarketFacetDimension {
  readonly key: string;
  readonly name: string;
  /** A single-choice style detail accepts one value at a time. */
  readonly isMulti: boolean;
  readonly values: readonly MarketFacetOption[];
}

export interface MarketFacets {
  readonly audience: readonly MarketFacetOption[];
  readonly categories: readonly MarketFacetOption[];
  readonly categoryTypes: readonly MarketFacetOption[];
  readonly brands: readonly MarketFacetOption[];
  readonly tags: readonly MarketFacetOption[];
  readonly colors: readonly MarketFacetOption[];
  readonly sizes: readonly MarketFacetOption[];
  readonly fulfilment: readonly MarketFacetOption[];
  readonly onSale: readonly MarketFacetOption[];
  readonly inStockOnly: readonly MarketFacetOption[];
  readonly dimensions: readonly MarketFacetDimension[];
  readonly price: {
    readonly min: number;
    readonly max: number;
    readonly count: number;
    readonly bands: readonly { min: number; max: number; count: number }[];
  } | null;
  readonly customFitCount: number | null;
}

/** A Market card, with the ranking context the server chose to disclose. */
export type MarketV2Item = MarketSectionItem & {
  readonly position?: number;
  readonly explore?: boolean;
};

export interface MarketV2Section {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly template: string | null;
  readonly layout: MarketSectionLayout;
  readonly items: MarketV2Item[];
  readonly reason: string | null;
  readonly personalization: string | null;
  readonly policyVersion: string | null;
  readonly viewAll: {
    readonly enabled: boolean;
    readonly label: string;
    readonly availableSorts: readonly MarketSort[];
  };
}

export interface MarketV2PageResponse {
  readonly generatedAt: string | null;
  /** Feature epoch the page was ranked in, when the server had one. */
  readonly epoch: string | null;
  /** The server omitted one or more sections it could not compose in time. */
  readonly partial: boolean;
  readonly sections: readonly MarketV2Section[];
}

export interface MarketV2ListPage extends MarketListPage<MarketV2Item> {
  readonly items: MarketV2Item[];
  readonly hasNextPage: boolean;
  readonly nextCursor: string | null;
  readonly availableSorts: readonly MarketSort[];
  readonly sortRequested: string | null;
  readonly sortEffective: string | null;
  /** `INSUFFICIENT_EVIDENCE` when a requested ranking could not be honoured. */
  readonly fallbackReason: string | null;
  readonly total: number | null;
  readonly facets: MarketFacets | null;
}

export interface MarketV2SectionPage extends MarketV2ListPage {
  readonly kind: 'v2';
  readonly section: {
    readonly key: string;
    readonly title: string;
    readonly subtitle: string | null;
    readonly layout: MarketSectionLayout;
    readonly sourceType: MarketSectionSourceType;
  };
}

export type MarketSectionPageResult =
  | MarketV2SectionPage
  | { readonly kind: 'legacy'; readonly response: MarketSectionDetailResponse };

const ENTITY_TYPES = new Set(['PRODUCT', 'COLLECTION', 'DESIGN', 'BRAND', 'CATEGORY']);
const SOURCE_TYPES = new Set(['PRODUCT', 'COLLECTION', 'DESIGN', 'BRAND', 'MIXED']);
const LAYOUTS = new Set(['HORIZONTAL_RAIL', 'PRODUCT_GRID', 'COLLECTION_RAIL', 'CATEGORY_GRID', 'BRAND_RAIL']);
const NOTICES = new Set<MarketListNotice>(['Updated', 'Prices updated']);

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** The API wraps payloads as `{ data, message, statusCode }`; accept both forms. */
const unwrap = (raw: unknown): unknown =>
  isRecord(raw) && 'data' in raw && 'statusCode' in raw ? raw.data : raw;

const parseItem = (raw: unknown): MarketV2Item | null => {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  const entityType = text(raw.entityType);
  const title = text(raw.title);
  if (!id || !entityType || !ENTITY_TYPES.has(entityType) || !title) return null;
  const rawSourceType = text(raw.sourceType);
  const sourceType = (rawSourceType && SOURCE_TYPES.has(rawSourceType)
    ? rawSourceType
    : SOURCE_TYPES.has(entityType) ? entityType : 'MIXED') as MarketSectionSourceType;

  let media: MarketSectionItem['media'] = null;
  if (isRecord(raw.media)) {
    const fileId = text(raw.media.fileId);
    const url = text(raw.media.url);
    const thumbnailUrl = text(raw.media.thumbnailUrl);
    const width = finite(raw.media.width);
    const height = finite(raw.media.height);
    media = {
      fileId,
      url: url ? stableMarketMediaUrl(fileId, url) : null,
      thumbnailUrl: thumbnailUrl ? stableMarketMediaUrl(fileId, thumbnailUrl) : null,
      type: raw.media.type === 'VIDEO' ? 'VIDEO' : raw.media.type === 'IMAGE' ? 'IMAGE' : 'UNKNOWN',
      alt: text(raw.media.alt),
      width: width && width > 0 ? width : null,
      height: height && height > 0 ? height : null,
      aspectRatio: finite(raw.media.aspectRatio),
    };
  }

  const price = isRecord(raw.price)
    ? {
        amount: finite(raw.price.amount),
        saleAmount: finite(raw.price.saleAmount),
        effectiveAmount: finite(raw.price.effectiveAmount),
        currency: text(raw.price.currency) ?? 'NGN',
      }
    : null;
  const priceRange = isRecord(raw.priceRange)
    ? {
        min: finite(raw.priceRange.min),
        max: finite(raw.priceRange.max),
        currency: text(raw.priceRange.currency) ?? 'NGN',
      }
    : null;
  const availability = isRecord(raw.availability)
    ? {
        totalStock: finite(raw.availability.totalStock),
        customOrderEnabled: raw.availability.customOrderEnabled === true,
        standardCheckoutEnabled: raw.availability.standardCheckoutEnabled === true,
        isOnSale: raw.availability.isOnSale === true,
      }
    : null;
  const logoUrl = isRecord(raw.brand) ? text(raw.brand.logoUrl) : null;
  const brand = isRecord(raw.brand)
    ? {
        id: text(raw.brand.id),
        name: text(raw.brand.name),
        logoUrl: logoUrl ? stableMarketMediaUrl(null, logoUrl) : null,
      }
    : null;
  const category = isRecord(raw.category)
    ? { id: text(raw.category.id), slug: text(raw.category.slug), name: text(raw.category.name) }
    : null;
  const target = isRecord(raw.target)
    ? {
        type: ENTITY_TYPES.has(String(raw.target.type))
          ? (raw.target.type as NonNullable<MarketSectionItem['target']>['type'])
          : undefined,
        id: text(raw.target.id),
        key: text(raw.target.key),
        route: text(raw.target.route),
      }
    : undefined;
  const stats = isRecord(raw.stats)
    ? { views: finite(raw.stats.views), threads: finite(raw.stats.threads), products: finite(raw.stats.products) }
    : undefined;

  const position = count(raw.position);
  return {
    id,
    sourceId: text(raw.sourceId) ?? id,
    sourceType,
    entityType: entityType as MarketSectionItem['entityType'],
    title,
    subtitle: text(raw.subtitle),
    description: text(raw.description),
    brand,
    media,
    price,
    priceRange,
    availability,
    category,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    stats,
    target,
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
    ...(position === null ? {} : { position }),
    ...(typeof raw.explore === 'boolean' ? { explore: raw.explore } : {}),
  };
};

/** Malformed cards are dropped; a card appearing twice keeps its first slot. */
const parseItems = (raw: unknown): MarketV2Item[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: MarketV2Item[] = [];
  for (const entry of raw) {
    const item = parseItem(entry);
    if (!item) continue;
    const key = `${item.entityType}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
};

const parseSorts = (raw: unknown): MarketSort[] =>
  Array.isArray(raw)
    ? [...new Set(raw.filter((sort): sort is MarketSort =>
        typeof sort === 'string' && (MARKET_SORTS as readonly string[]).includes(sort)))]
    : [];

const parseLayout = (raw: unknown): MarketSectionLayout =>
  (typeof raw === 'string' && LAYOUTS.has(raw) ? raw : 'HORIZONTAL_RAIL') as MarketSectionLayout;

const parseSection = (raw: unknown): MarketV2Section | null => {
  if (!isRecord(raw)) return null;
  const key = text(raw.key);
  const title = text(raw.title);
  if (!key || !title) return null;
  const items = parseItems(raw.items);
  // A rail with nothing renderable is omitted, never padded.
  if (items.length === 0) return null;
  const viewAll = isRecord(raw.viewAll) ? raw.viewAll : {};
  return {
    key,
    title,
    subtitle: text(raw.subtitle),
    template: text(raw.template),
    layout: parseLayout(raw.layout),
    items,
    reason: text(raw.reason),
    personalization: text(raw.personalization),
    policyVersion:
      typeof raw.policyVersion === 'number' && Number.isSafeInteger(raw.policyVersion)
        ? String(raw.policyVersion)
        : text(raw.policyVersion),
    viewAll: {
      enabled: viewAll.enabled === true,
      label: text(viewAll.label) ?? 'View all',
      availableSorts: parseSorts(viewAll.availableSorts),
    },
  };
};

export function parseMarketPageResponse(raw: unknown): MarketV2PageResponse {
  const data = unwrap(raw);
  if (!isRecord(data) || !Array.isArray(data.sections)) throw new MarketV2ContractError('/market/page');
  const seen = new Set<string>();
  const sections: MarketV2Section[] = [];
  for (const entry of data.sections) {
    const section = parseSection(entry);
    if (!section || seen.has(section.key)) continue;
    seen.add(section.key);
    sections.push(section);
  }
  return {
    generatedAt: text(data.generatedAt),
    epoch: text(data.epoch),
    partial: isRecord(data.metadata) && data.metadata.partial === true,
    sections,
  };
}

const parseFacetOptions = (raw: unknown): MarketFacetOption[] => {
  if (!Array.isArray(raw)) return [];
  const options: MarketFacetOption[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const value = text(entry.value);
    const label = text(entry.label);
    const optionCount = count(entry.count);
    if (!value || !label || optionCount === null) continue;
    options.push({
      value,
      label,
      count: optionCount,
      disabled: entry.disabled === true || optionCount === 0,
      categoryId: text(entry.categoryId),
    });
  }
  return options;
};

export function parseMarketFacets(raw: unknown): MarketFacets | null {
  const data = unwrap(raw);
  if (!isRecord(data)) return null;
  const dimensions: MarketFacetDimension[] = [];
  if (isRecord(data.dimensions)) {
    for (const [key, value] of Object.entries(data.dimensions)) {
      if (!isRecord(value) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(key)) continue;
      const values = parseFacetOptions(value.values);
      if (values.length === 0) continue;
      dimensions.push({ key, name: text(value.name) ?? key, isMulti: value.isMulti === true, values });
    }
  }
  let price: MarketFacets['price'] = null;
  if (isRecord(data.price)) {
    const min = finite(data.price.min);
    const max = finite(data.price.max);
    const priceCount = count(data.price.count);
    if (min !== null && max !== null && priceCount !== null && min <= max) {
      const bands = Array.isArray(data.price.bands)
        ? data.price.bands.flatMap((band) => {
            if (!isRecord(band)) return [];
            const bandMin = finite(band.min);
            const bandMax = finite(band.max);
            const bandCount = count(band.count);
            return bandMin !== null && bandMax !== null && bandCount !== null && bandMin <= bandMax
              ? [{ min: bandMin, max: bandMax, count: bandCount }]
              : [];
          })
        : [];
      price = { min, max, count: priceCount, bands };
    }
  }
  return {
    audience: parseFacetOptions(data.audience),
    categories: parseFacetOptions(data.categories),
    categoryTypes: parseFacetOptions(data.categoryTypes),
    brands: parseFacetOptions(data.brands),
    tags: parseFacetOptions(data.tags),
    colors: parseFacetOptions(data.colors),
    sizes: parseFacetOptions(data.sizes),
    fulfilment: parseFacetOptions(data.fulfilment),
    onSale: parseFacetOptions(data.onSale),
    inStockOnly: parseFacetOptions(data.inStockOnly),
    dimensions,
    price,
    customFitCount: isRecord(data.sizeSupport) ? count(data.sizeSupport.customFitCount) : null,
  };
}

const parseListPage = (
  data: Json,
  pagination: unknown,
  endpoint: string,
): MarketV2ListPage => {
  if (!isRecord(pagination)) throw new MarketV2ContractError(endpoint);
  const meta = isRecord(data.meta) ? data.meta : {};
  const sort = isRecord(data.sort) ? data.sort : {};
  const nextCursor = text(pagination.nextCursor);
  const notice = typeof meta.notice === 'string' && NOTICES.has(meta.notice as MarketListNotice)
    ? (meta.notice as MarketListNotice)
    : null;
  return {
    items: parseItems(data.items ?? (isRecord(data.section) ? data.section.items : undefined)),
    hasNextPage: pagination.hasNextPage === true && nextCursor !== null,
    nextCursor: pagination.hasNextPage === true ? nextCursor : null,
    reanchored: pagination.reanchored === true,
    notice,
    availableSorts: parseSorts(data.availableSorts),
    sortRequested: text(sort.requested),
    sortEffective: text(sort.effective),
    fallbackReason: text(meta.fallbackReason),
    total: count(data.total),
    facets: 'facets' in data ? parseMarketFacets(data.facets) : null,
  };
};

export function parseMarketCatalogResponse(raw: unknown): MarketV2ListPage {
  const data = unwrap(raw);
  if (!isRecord(data) || !Array.isArray(data.items)) throw new MarketV2ContractError('/market/catalog');
  return parseListPage(data, data.pagination, '/market/catalog');
}

/**
 * See All answers in one of two shapes. The server-composed list carries
 * `availableSorts` and `meta`; the established section reader does not. The
 * shape, not a guess about flags, decides which renderer the page uses.
 */
export function parseMarketSectionResponse(raw: unknown): MarketSectionPageResult {
  const data = unwrap(raw);
  if (!isRecord(data) || !isRecord(data.section)) throw new MarketV2ContractError('/market/sections');
  if (!Array.isArray(data.availableSorts) || !isRecord(data.meta)) {
    return {
      kind: 'legacy',
      response: normalizeMarketSectionDetailResponse(data as unknown as MarketSectionDetailResponse),
    };
  }
  const section = data.section;
  const key = text(section.key);
  const title = text(section.title);
  if (!key || !title) throw new MarketV2ContractError('/market/sections');
  const rawSourceType = text(section.sourceType);
  return {
    kind: 'v2',
    ...parseListPage(data, section.pagination, '/market/sections'),
    section: {
      key,
      title,
      subtitle: text(section.subtitle),
      layout: parseLayout(section.layout),
      sourceType: (rawSourceType && SOURCE_TYPES.has(rawSourceType) ? rawSourceType : 'MIXED') as MarketSectionSourceType,
    },
  };
}

export interface MarketListRequest {
  readonly filters: MarketFilters;
  readonly sort?: MarketSort | null;
  readonly cursor?: string | null;
  readonly limit?: number;
  readonly includeFacets?: boolean;
  readonly anonymousSessionId?: string | null;
}

const ANONYMOUS_SESSION = /^[A-Za-z0-9_-]{16,128}$/;

/** One query builder for every list request, so filters always match the URL. */
export function buildMarketListQuery(request: MarketListRequest): URLSearchParams {
  const params = marketFiltersToParams(request.filters);
  if (request.sort) params.set('sort', request.sort);
  if (request.cursor) params.set('cursor', request.cursor);
  if (request.limit !== undefined) params.set('limit', String(request.limit));
  if (request.includeFacets) params.set('includeFacets', '1');
  if (request.anonymousSessionId && ANONYMOUS_SESSION.test(request.anonymousSessionId)) {
    params.set('anonymousSessionId', request.anonymousSessionId);
  }
  return params;
}

export const MARKET_HOME_SECTION_LIMIT = 8;
export const MARKET_CATALOG_PAGE_SIZE = 24;
export const MARKET_SECTION_PAGE_SIZE = 24;

export const marketV2Api = {
  async getPage(
    request: { filters: MarketFilters; anonymousSessionId?: string | null },
    options?: { signal?: AbortSignal },
  ): Promise<MarketV2PageResponse> {
    const params = buildMarketListQuery({
      filters: request.filters,
      anonymousSessionId: request.anonymousSessionId,
    });
    params.set('limit', String(MARKET_HOME_SECTION_LIMIT));
    const response = await apiClient.get('/market/page', { params, signal: options?.signal });
    return parseMarketPageResponse(response.data);
  },

  async getCatalog(
    request: MarketListRequest,
    options?: { signal?: AbortSignal },
  ): Promise<MarketV2ListPage> {
    const response = await apiClient.get('/market/catalog', {
      params: buildMarketListQuery({ limit: MARKET_CATALOG_PAGE_SIZE, ...request }),
      signal: options?.signal,
    });
    return parseMarketCatalogResponse(response.data);
  },

  async getSectionPage(
    key: string,
    request: MarketListRequest,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSectionPageResult> {
    const response = await apiClient.get(`/market/sections/${encodeURIComponent(key)}`, {
      params: buildMarketListQuery({ limit: MARKET_SECTION_PAGE_SIZE, ...request }),
      signal: options?.signal,
    });
    return parseMarketSectionResponse(response.data);
  },

  async getSectionFacets(
    key: string,
    request: { filters: MarketFilters; anonymousSessionId?: string | null },
    options?: { signal?: AbortSignal },
  ): Promise<MarketFacets | null> {
    const params = buildMarketListQuery({
      filters: request.filters,
      anonymousSessionId: request.anonymousSessionId,
    });
    params.set('surface', 'SEE_ALL');
    params.set('sectionKey', key);
    const response = await apiClient.get('/market/facets', { params, signal: options?.signal });
    return parseMarketFacets(response.data);
  },
};

export default marketV2Api;
