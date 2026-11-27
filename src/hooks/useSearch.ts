import { useEffect, useRef, useState } from 'react';
import SearchApi from '@/api/SearchApi';
import type { SearchEntityType, SearchResponse } from '@/types/search';

interface UseSearchParams {
  query: string;
  type?: SearchEntityType | 'all';
  brandId?: string;
  enabled?: boolean;
  limit?: number;
  /** Lexicon product search only; the server's relevance order when omitted. */
  sort?: string | null;
  /** Canonical catalogue filter encoding; empty for none. */
  filters?: string;
  /** Ask for product facets with the first page. */
  includeFacets?: boolean;
}

export default function useSearch({
  query,
  type,
  brandId,
  enabled = true,
  limit = 20,
  sort = null,
  filters = '',
  includeFacets = false,
}: UseSearchParams) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const lastQueryKey = useRef('');

  useEffect(() => {
    const nextKey = `${query}::${type || 'all'}::${brandId || ''}::${limit}::${sort ?? ''}::${filters}::${includeFacets}`;
    if (lastQueryKey.current !== nextKey) {
      lastQueryKey.current = nextKey;
      setPage(1);
      setResults(null);
    }
  }, [brandId, filters, includeFacets, limit, query, sort, type]);

  useEffect(() => {
    if (!enabled || !query.trim()) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    const controller = new AbortController();
    const loadingMore = page > 1;
    setError(null);
    if (loadingMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    SearchApi.search(
      {
        q: query,
        type,
        page,
        limit,
        brandId,
        ...(sort ? { sort } : {}),
        ...(filters ? { filters } : {}),
        // Facets describe the whole matched set, so only the first page asks.
        ...(includeFacets && !loadingMore ? { includeFacets: '1' as const } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setResults((current) => {
          if (!loadingMore || !current) {
            return response;
          }

          return {
            ...response,
            items: [...current.items, ...response.items],
            // Later pages carry no facets; keep the first page's view of the query.
            parsed: current.parsed ?? response.parsed,
            availableSorts: current.availableSorts ?? response.availableSorts,
            facets: current.facets ?? response.facets,
          };
        });
      })
      .catch((err: any) => {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') {
          return;
        }
        setError(err?.message || 'Search failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [brandId, enabled, filters, includeFacets, limit, page, query, sort, type]);

  return {
    results,
    isLoading,
    isLoadingMore,
    error,
    loadMore: () => {
      if (results?.meta.hasNextPage) {
        setPage((current) => current + 1);
      }
    },
  };
}
