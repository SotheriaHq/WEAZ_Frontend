import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { queryKeys } from '@/query/queryKeys';
import {
  CLIP_ADDED_TOAST,
  CLIP_ERROR_TOAST,
  CLIP_REMOVED_TOAST,
  CLIP_SIGN_IN_TOAST,
} from '@/constants/clipping';

export type ClipTargetType = 'DESIGN' | 'PRODUCT' | 'COLLECTION' | 'COLLECTION_MEDIA';

/**
 * Clipping a target, once, for the whole app.
 *
 * The symptom this exists for: a shopper clips a piece in the viewer, closes
 * it, scrolls back to the grid, and the card is unclipped again. Nothing was
 * lost — every surface simply kept its OWN answer. `DesignCard` held a
 * `useState` fed by its own `GET /saved/check` on mount, the viewer held
 * another, the reels rail a third, and the batch map behind a grid a fourth. A
 * write through any one of them left the other three saying the opposite until
 * their cache aged out, which is also why the count under a card drifted.
 *
 * So the write is the place to fix it. `writeClipStatus` fans the new value
 * into every cache that can answer "is this clipped?" — the per-target status
 * key AND every batch map that happens to contain this id (matched by key
 * prefix, since a batch key carries the whole id list) — and then marks the
 * shopper's Clips tab stale so it refetches when they next look at it. Surfaces
 * read those caches, so they all change together.
 *
 * The cache keys stay `saved.*` and the endpoints stay `/saved`: the server
 * calls this a saved item and renaming the wire would be a migration, not a
 * relabel.
 */

/** Write a known clip state into every cache that can answer for this target. */
export function writeClipStatus(
  queryClient: QueryClient,
  targetType: ClipTargetType,
  targetId: string,
  clipped: boolean,
): void {
  if (!targetId) return;

  queryClient.setQueryData(queryKeys.saved.status(targetType, targetId), clipped);

  // Prefix match: a batch key ends in the id LIST, so the exact key is unknowable
  // from here. Only maps that already track this id are touched — adding it to a
  // map that never asked for it would make that map lie about its own request.
  queryClient.setQueriesData<Record<string, boolean>>(
    { queryKey: ['saved', 'batch', targetType] },
    (current) => {
      if (!current || !(targetId in current)) return current;
      if (current[targetId] === clipped) return current;
      return { ...current, [targetId]: clipped };
    },
  );

  // The Clips tab is a list, not a flag, so it has to come back from the server.
  // Only `saved.me` — a prefix of `['saved']` would also mark the two caches
  // written just above as stale, which is the opposite of the point.
  void queryClient.invalidateQueries({ queryKey: ['saved', 'me'], refetchType: 'none' });
}

export interface ToggleClipInput {
  targetType: ClipTargetType;
  targetId: string;
  /** What the caller believes the current state to be. */
  clipped: boolean;
  isAuthenticated?: boolean;
  /** Suppress the toast where the surface says it another way. */
  silent?: boolean;
}

export interface UseClipTargetResult {
  /** Resolves to the NEW state, or null when nothing changed. */
  toggleClip: (input: ToggleClipInput) => Promise<boolean | null>;
  setClipStatus: (targetType: ClipTargetType, targetId: string, clipped: boolean) => void;
}

export function useClipTarget(): UseClipTargetResult {
  const queryClient = useQueryClient();

  const setClipStatus = useCallback(
    (targetType: ClipTargetType, targetId: string, clipped: boolean) => {
      writeClipStatus(queryClient, targetType, targetId, clipped);
    },
    [queryClient],
  );

  const toggleClip = useCallback(
    async ({
      targetType,
      targetId,
      clipped,
      isAuthenticated = true,
      silent = false,
    }: ToggleClipInput): Promise<boolean | null> => {
      if (!targetId) return null;
      if (!isAuthenticated) {
        toast.info(CLIP_SIGN_IN_TOAST);
        return null;
      }

      const next = !clipped;
      // Paint first: the control is the confirmation, so it must not wait for
      // the round trip. The catch below puts it back if the server disagrees.
      writeClipStatus(queryClient, targetType, targetId, next);

      try {
        if (clipped) {
          await apiClient.delete('/saved', { data: { targetType, targetId } });
        } else {
          await apiClient.post('/saved', { targetType, targetId });
        }
        if (!silent) {
          toast.success(next ? CLIP_ADDED_TOAST : CLIP_REMOVED_TOAST);
        }
        return next;
      } catch {
        writeClipStatus(queryClient, targetType, targetId, clipped);
        toast.error(CLIP_ERROR_TOAST);
        return null;
      }
    },
    [queryClient],
  );

  return { toggleClip, setClipStatus };
}

export default useClipTarget;
