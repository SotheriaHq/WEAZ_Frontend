import { useQuery, type QueryKey } from '@tanstack/react-query';

/**
 * useCachedResource — the standard way to fetch read-only screen/tab data.
 *
 * WHY THIS EXISTS
 * ---------------
 * Older screens fetch with `const [loading, setLoading] = useState(true)` plus a
 * `useEffect(fetch, [])`. Because routes are lazy and unmount on navigation, every
 * return to a screen restarts from `loading = true` -> skeleton -> refetch. That is
 * the "I was just here, why is it loading again?" flash.
 *
 * This hook routes the fetch through the shared TanStack Query client (see
 * `src/query/queryClient.ts`: staleTime 3m, gcTime 30m, refetchOnMount false). On
 * revisit within the retention window, cached data paints INSTANTLY (`loading` is
 * false) while a silent background revalidation runs if the data is stale. No skeleton.
 *
 * MIGRATION RECIPE (per screen)
 * -----------------------------
 *   // before
 *   const [items, setItems] = useState<T[]>([]);
 *   const [loading, setLoading] = useState(true);
 *   const [error, setError] = useState<string | null>(null);
 *   useEffect(() => { setLoading(true); fetch()...; }, [dep]);
 *
 *   // after
 *   const { data: items = [], loading, error, refetch } = useCachedResource({
 *     queryKey: ['saved', 'me'],
 *     queryFn: async ({ signal }) => toItems(await apiClient.get('/saved/me', { signal })),
 *     enabled: isOwner,
 *   });
 *
 * Do the response transform INSIDE queryFn so the cache holds ready-to-render data.
 * Use a stable, serializable queryKey; include anything the fetch depends on
 * (e.g. `['orders', 'me', statusFilter]`).
 */
export interface CachedResourceOptions<T> {
  /** Stable, serializable cache key. Include every value the fetch depends on. */
  queryKey: QueryKey;
  /** Fetcher. Forward the AbortSignal to your HTTP call so revalidations cancel cleanly. */
  queryFn: (ctx: { signal: AbortSignal }) => Promise<T>;
  /** When false, the fetch is skipped and `loading` stays false. Default true. */
  enabled?: boolean;
  /** Seed value used until the first fetch resolves (treated as fresh for `staleTime`). */
  initialData?: T;
  /** Override the global 3-minute freshness window for this resource. */
  staleTime?: number;
  /** Override the global 30-minute in-memory retention for this resource. */
  gcTime?: number;
}

export interface CachedResource<T> {
  data: T | undefined;
  /**
   * True ONLY on the first load when no cached data exists yet. This is the value
   * to gate skeletons on — on a cached revisit it is false, so no skeleton flashes.
   */
  loading: boolean;
  /** True whenever a fetch (initial OR silent background revalidation) is in flight. */
  fetching: boolean;
  error: Error | null;
  /** Force an immediate revalidation (e.g. a manual "Retry"/"Refresh" button). */
  refetch: () => void;
}

export function useCachedResource<T>(
  options: CachedResourceOptions<T>,
): CachedResource<T> {
  const { queryKey, queryFn, enabled = true, initialData, staleTime, gcTime } = options;

  const query = useQuery<T>({
    queryKey,
    queryFn: ({ signal }) => queryFn({ signal }),
    enabled,
    ...(initialData !== undefined ? { initialData } : {}),
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(gcTime !== undefined ? { gcTime } : {}),
  });

  return {
    data: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

export default useCachedResource;
