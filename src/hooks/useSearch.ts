import { useEffect, useRef, useState } from 'react';
import SearchApi from '@/api/SearchApi';
import type { SearchEntityType, SearchResponse } from '@/types/search';

interface UseSearchParams {
  query: string;
  type?: SearchEntityType | 'all';
  brandId?: string;
  enabled?: boolean;
  limit?: number;
}

export default function useSearch({
  query,
  type,
  brandId,
  enabled = true,
  limit = 20,
}: UseSearchParams) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const lastQueryKey = useRef('');

  useEffect(() => {
    const nextKey = `${query}::${type || 'all'}::${brandId || ''}::${limit}`;
    if (lastQueryKey.current !== nextKey) {
      lastQueryKey.current = nextKey;
      setPage(1);
      setResults(null);
    }
  }, [brandId, limit, query, type]);

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
  }, [brandId, enabled, limit, page, query, type]);

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