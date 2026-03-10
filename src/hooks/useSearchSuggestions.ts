import { useEffect, useState } from 'react';
import SearchApi from '@/api/SearchApi';
import type { SearchSuggestionResponse } from '@/types/search';

interface UseSearchSuggestionsOptions {
  enabled?: boolean;
  brandId?: string;
}

export default function useSearchSuggestions(
  query: string,
  options: UseSearchSuggestionsOptions = {},
) {
  const [suggestions, setSuggestions] = useState<SearchSuggestionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) {
      setSuggestions(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setSuggestions(null);
    setIsLoading(true);
    setError(null);

    SearchApi.suggest({ q: query || undefined, brandId: options.brandId }, controller.signal)
      .then((result) => {
        setSuggestions(result);
      })
      .catch((err: any) => {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') {
          return;
        }
        setError(err?.message || 'Failed to load search suggestions');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [options.brandId, options.enabled, query]);

  return { suggestions, isLoading, error };
}