import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';

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
  /**
   * Poll interval in ms for near-real-time data (e.g. dashboards, live counts).
   * Omit to disable polling (default). Polling pauses while the tab is in the
   * background to avoid needless load.
   */
  refetchInterval?: number;
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
  /**
   * True while `data` still belongs to the PREVIOUS query key.
   *
   * Switching a filter chip keeps the old results on screen until the new ones
   * land. They are real results, just answering the previous question — so a
   * surface that wants to say so can dim them. Nothing is obliged to.
   */
  stale: boolean;
  error: Error | null;
  /** Force an immediate revalidation (e.g. a manual "Retry"/"Refresh" button). */
  refetch: () => Promise<void>;
}

export function useCachedResource<T>(
  options: CachedResourceOptions<T>,
): CachedResource<T> {
  const { queryKey, queryFn, enabled = true, initialData, staleTime, gcTime, refetchInterval } = options;

  const query = useQuery<T>({
    queryKey,
    queryFn: ({ signal }) => queryFn({ signal }),
    enabled,
    /*
     * Keep the previous key's data on screen while the next one loads.
     *
     * Without this, changing a filter chip is an entirely NEW query as far as
     * React Query is concerned: `data` drops to undefined and `isLoading` flips
     * back to true, so the screen unmounts its content, mounts a skeleton, then
     * mounts content again — three layouts for one tap. That is the flicker,
     * and it is also why the SKELETONS flickered: they were being mounted fresh
     * on every chip press rather than persisting across the change.
     *
     * With it, the old results stay put, `isLoading` stays false, and the only
     * thing that changes is `isPlaceholderData`. One layout, no flash.
     */
    placeholderData: keepPreviousData,
    ...(initialData !== undefined ? { initialData } : {}),
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(gcTime !== undefined ? { gcTime } : {}),
    ...(refetchInterval !== undefined
      ? { refetchInterval, refetchIntervalInBackground: false }
      : {}),
  });

  return {
    data: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    stale: query.isPlaceholderData,
    error: (query.error as Error | null) ?? null,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export default useCachedResource;
