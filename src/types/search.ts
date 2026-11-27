export type SearchEntityType = 'profile' | 'product' | 'brand' | 'design' | 'collection' | 'tag';

export interface SearchHighlightOffset {
  start: number;
  end: number;
}

export interface SearchItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  href: string;
  score: number;
  price?: number | null;
  salePrice?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown>;
  highlights?: {
    title?: SearchHighlightOffset[];
    description?: SearchHighlightOffset[];
  };
}

export interface SearchSuggestionLink {
  query: string;
  href: string;
}

export interface SearchTrendingLink extends SearchSuggestionLink {
  score: number;
}

export interface SearchSuggestionSection {
  items: SearchItem[];
  total: number;
}

export interface SearchSuggestionTag {
  id: string;
  type: 'tag';
  title: string;
  href: string;
  score: number;
}

export interface SearchSuggestionResponse {
  query: string;
  normalizedQuery: string;
  recent: SearchSuggestionLink[];
  trending: SearchTrendingLink[];
  profiles: SearchSuggestionSection;
  products: SearchSuggestionSection;
  brands: SearchSuggestionSection;
  designs: SearchSuggestionSection;
  storeCollections: SearchSuggestionSection;
  tags: SearchSuggestionTag[];
}

/** How the server read the query (lexicon search only). */
export interface SearchParsedQuery {
  attributes: { type: string; value: string; label: string; confidence: number; applied: boolean }[];
  residual: string;
  corrections: { from: string; to: string; applied: boolean }[];
}

/** Product facets over the whole matched set (lexicon search, first page only). */
export interface SearchProductFacets {
  color: { value: string; count: number }[];
  size: { value: string; count: number }[];
  brand: { id: string; name: string; count: number }[];
  price: { min: number; max: number; p30: number; p60: number } | null;
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  types: SearchEntityType[];
  items: SearchItem[];
  counts: Record<SearchEntityType, number>;
  meta: {
    page: number;
    limit: number;
    hasNextPage: boolean;
  };
  /** Present only when the server runs lexicon search for products. */
  parsed?: SearchParsedQuery;
  availableSorts?: string[];
  facets?: SearchProductFacets;
}

export interface SearchRequestParams {
  q: string;
  type?: SearchEntityType | 'all';
  page?: number;
  limit?: number;
  brandId?: string;
  /** Lexicon product search: `relevance` when omitted. */
  sort?: string;
  /** Canonical catalogue filter encoding (the keys `/market/catalog` takes). */
  filters?: string;
  includeFacets?: '1';
}
