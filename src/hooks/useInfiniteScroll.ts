import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  limit?: number;
  enabled?: boolean;
  rootMargin?: string;
}

interface UseInfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  sentinelRef: React.RefCallback<HTMLDivElement>;
  reset: () => void;
}

type FetchFn<T> = (
  cursor: string | undefined,
  limit: number,
) => Promise<{ items: T[]; nextCursor?: string }>;

/**
 * Cursor-based infinite scroll hook using IntersectionObserver.
 * Attach `sentinelRef` to a <div> at the bottom of the list.
 */
export function useInfiniteScroll<T>(
  fetchFn: FetchFn<T>,
  options?: UseInfiniteScrollOptions,
): UseInfiniteScrollResult<T> {
  const limit = options?.limit ?? 30;
  const enabled = options?.enabled ?? true;
  const rootMargin = options?.rootMargin ?? '200px';

  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monotonic version counter to discard stale fetches
  const versionRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(
    async (pageCursor: string | undefined, append: boolean, ver: number) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      try {
        const res = await fetchFn(pageCursor, limit);
        // Discard stale response
        if (ver !== versionRef.current) return;

        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
        setHasMore(!!res.nextCursor);
        setError(null);
      } catch (err: any) {
        if (ver !== versionRef.current) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load');
        setHasMore(false);
      } finally {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [fetchFn, limit],
  );

  // Initial fetch + reset when fetchFn identity changes (e.g. search/filter changed)
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }
    const ver = ++versionRef.current;
    fetchingRef.current = false;
    setCursor(undefined);
    setHasMore(true);
    setError(null);
    fetchPage(undefined, false, ver);
  }, [fetchPage, enabled]);

  // IntersectionObserver callback — load next page
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (
        entries[0]?.isIntersecting &&
        hasMore &&
        !fetchingRef.current &&
        enabled
      ) {
        const ver = versionRef.current;
        fetchPage(cursor, true, ver);
      }
    },
    [cursor, hasMore, fetchPage, enabled],
  );

  // Observe / unobserve sentinel node
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin,
    });
    if (sentinelNodeRef.current) {
      observerRef.current.observe(sentinelNodeRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [handleIntersect, rootMargin]);

  // Ref callback so we can swap the sentinel DOM node at any time
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (sentinelNodeRef.current && observerRef.current) {
        observerRef.current.unobserve(sentinelNodeRef.current);
      }
      sentinelNodeRef.current = node;
      if (node && observerRef.current) {
        observerRef.current.observe(node);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    const ver = ++versionRef.current;
    fetchingRef.current = false;
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    setError(null);
    fetchPage(undefined, false, ver);
  }, [fetchPage]);

  return { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, reset };
}
