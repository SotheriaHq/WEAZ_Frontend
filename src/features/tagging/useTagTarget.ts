import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { queryKeys } from '@/query/queryKeys';
import {
  TAG_ADDED_TOAST,
  TAG_ERROR_TOAST,
  TAG_REMOVED_TOAST,
  TAG_SIGN_IN_TOAST,
} from '@/constants/tagging';

export type TagTargetType = 'DESIGN' | 'PRODUCT' | 'COLLECTION' | 'COLLECTION_MEDIA';

/**
 * Tagging a target, once, for the whole app.
 *
 * The symptom this exists for: a shopper tags a piece in the viewer, closes it,
 * scrolls back to the grid, and the card is untagged again. Nothing was lost —
 * every surface simply kept its OWN answer. `DesignCard` held a `useState` fed
 * by its own `GET /saved/check` on mount, the viewer held another, the reels
 * rail a third, and the batch map behind a grid a fourth. A write through any
 * one of them left the other three saying the opposite until their cache aged
 * out, which is also why the count under a card drifted.
 *
 * So the write is the place to fix it. `writeTagStatus` fans the new value into
 * every cache that can answer "is this tagged?" — the per-target status key AND
 * every batch map that happens to contain this id (matched by key prefix, since
 * a batch key carries the whole id list) — and then marks the shopper's Tags tab
 * stale so it refetches when they next look at it. Surfaces read those caches,
 * so they all change together.
 */

/** Write a known tag state into every cache that can answer for this target. */
export function writeTagStatus(
  queryClient: QueryClient,
  targetType: TagTargetType,
  targetId: string,
  tagged: boolean,
): void {
  if (!targetId) return;

  queryClient.setQueryData(queryKeys.saved.status(targetType, targetId), tagged);

  // Prefix match: a batch key ends in the id LIST, so the exact key is unknowable
  // from here. Only maps that already track this id are touched — adding it to a
  // map that never asked for it would make that map lie about its own request.
  queryClient.setQueriesData<Record<string, boolean>>(
    { queryKey: ['saved', 'batch', targetType] },
    (current) => {
      if (!current || !(targetId in current)) return current;
      if (current[targetId] === tagged) return current;
      return { ...current, [targetId]: tagged };
    },
  );

  // The Tags tab is a list, not a flag, so it has to come back from the server.
  // Only `saved.me` — a prefix of `['saved']` would also mark the two caches
  // written just above as stale, which is the opposite of the point.
  void queryClient.invalidateQueries({ queryKey: ['saved', 'me'], refetchType: 'none' });
}

export interface ToggleTagInput {
  targetType: TagTargetType;
  targetId: string;
  /** What the caller believes the current state to be. */
  tagged: boolean;
  isAuthenticated?: boolean;
  /** Suppress the toast where the surface says it another way. */
  silent?: boolean;
}

export interface UseTagTargetResult {
  /** Resolves to the NEW state, or null when nothing changed. */
  toggleTag: (input: ToggleTagInput) => Promise<boolean | null>;
  setTagStatus: (targetType: TagTargetType, targetId: string, tagged: boolean) => void;
}

export function useTagTarget(): UseTagTargetResult {
  const queryClient = useQueryClient();

  const setTagStatus = useCallback(
    (targetType: TagTargetType, targetId: string, tagged: boolean) => {
      writeTagStatus(queryClient, targetType, targetId, tagged);
    },
    [queryClient],
  );

  const toggleTag = useCallback(
    async ({
      targetType,
      targetId,
      tagged,
      isAuthenticated = true,
      silent = false,
    }: ToggleTagInput): Promise<boolean | null> => {
      if (!targetId) return null;
      if (!isAuthenticated) {
        toast.info(TAG_SIGN_IN_TOAST);
        return null;
      }

      const next = !tagged;
      // Paint first: the control is the confirmation, so it must not wait for
      // the round trip. The catch below puts it back if the server disagrees.
      writeTagStatus(queryClient, targetType, targetId, next);

      try {
        if (tagged) {
          await apiClient.delete('/saved', { data: { targetType, targetId } });
        } else {
          await apiClient.post('/saved', { targetType, targetId });
        }
        if (!silent) {
          toast.success(next ? TAG_ADDED_TOAST : TAG_REMOVED_TOAST);
        }
        return next;
      } catch {
        writeTagStatus(queryClient, targetType, targetId, tagged);
        toast.error(TAG_ERROR_TOAST);
        return null;
      }
    },
    [queryClient],
  );

  return { toggleTag, setTagStatus };
}

export default useTagTarget;
