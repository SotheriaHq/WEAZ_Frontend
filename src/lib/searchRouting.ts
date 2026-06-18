import type { SearchEntityType, SearchItem } from '@/types/search';

export interface SearchResultRoute {
  /** Path (with query string) to navigate to. */
  to: string;
  /** Navigation kind, useful for tests and back-behaviour decisions. */
  kind: 'runwayPinned' | 'brandStore' | 'identity' | 'default';
  /** Router state to attach (e.g. so back can skip the search list). */
  state?: Record<string, unknown>;
}

/**
 * Build the Runway search-pinned URL for a selected design.
 */
export function buildRunwayPinnedHref(query: string, anchorDesignId?: string): string {
  const params = new URLSearchParams();
  params.set('feedMode', 'searchPinned');
  if (query.trim()) {
    params.set('query', query.trim());
  }
  if (anchorDesignId) {
    params.set('anchorDesignId', anchorDesignId);
  }
  return `/market?${params.toString()}`;
}

/**
 * SEARCH-CORE-5 result tap routing. Backend owns relevance; the client only
 * decides which surface a result opens:
 *   - design (and design+product) -> Runway pinned mode, the design as anchor.
 *   - product-only -> the owning brand store/catalog, not the general Market.
 *   - brand/profile identity -> existing public profile/catalog behaviour.
 *   - tag/collection/other -> existing href behaviour.
 *
 * `query` is the active search text, threaded into pinned mode so Runway can
 * continue matching it as the user scrolls.
 */
export function resolveSearchResultRoute(
  item: SearchItem,
  query: string,
): SearchResultRoute {
  if (item.type === 'design') {
    // Design wins for design+product results: the design id is the anchor.
    return {
      to: buildRunwayPinnedHref(query, item.id),
      kind: 'runwayPinned',
      state: { fromSearch: true, pinnedQuery: query, anchorDesignId: item.id },
    };
  }

  if (item.type === 'product') {
    const ownerId =
      (item.metadata?.brandOwnerId as string | undefined) ||
      (item.metadata?.ownerId as string | undefined);
    if (ownerId) {
      return {
        to: `/profile/${ownerId}`,
        kind: 'brandStore',
        // Lets the brand store send the user back to the Runway default feed
        // instead of the stale search results list.
        state: { fromSearch: true, returnTo: '/market' },
      };
    }
    return { to: item.href, kind: 'default', state: { fromSearch: true } };
  }

  // profile, brand, collection, tag — keep existing behaviour.
  return {
    to: item.href,
    kind: item.type === 'profile' || item.type === 'brand' ? 'identity' : 'default',
  };
}

export function resolveSearchIntent(query: string): {
  query: string;
  type?: SearchEntityType | 'all';
} {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: '' };
  }

  if (trimmed.startsWith('@')) {
    return { query: trimmed, type: 'profile' };
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return { query: trimmed, type: 'tag' };
  }

  return { query: trimmed, type: 'all' };
}

export function buildSearchHref(query: string): string {
  const intent = resolveSearchIntent(query);
  if (!intent.query) {
    return '/search';
  }

  const params = new URLSearchParams();
  params.set('q', intent.query);
  if (intent.type && intent.type !== 'all') {
    params.set('type', intent.type);
  }
  return `/search?${params.toString()}`;
}
