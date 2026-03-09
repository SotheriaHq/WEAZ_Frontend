import React, { useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { optimisticToggle, reconcile, setThreadState, wsApplied, adjustAggregatedCollectionThreads } from '@/features/engagementSlice';
import { ReactionsApi } from '@/api/ReactionsApi';
import { useRealtime } from '@/realtime';
import ThreadListModal from '@/components/engagement/ThreadListModal';
import { OfflineThreads } from '@/lib/offlineThreads';
import { toast } from 'sonner';

type ContentType = 'COLLECTION' | 'COLLECTION_MEDIA';

type Props = {
  contentType: ContentType;
  contentId: string;
  initialCount?: number;
  initialThreaded?: boolean;
  className?: string;
  size?: number;
  ownerId?: string;
  parentCollectionId?: string; // For COLLECTION_MEDIA threads aggregation
};

const ThreadButton: React.FC<Props> = ({ 
  contentType, 
  contentId, 
  initialCount = 0, 
  initialThreaded, 
  className, 
  size = 20,
  ownerId,
  parentCollectionId,
}) => {
  const dispatch = useDispatch();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  const [showThreadBurst, setShowThreadBurst] = React.useState(false);
  const k = `${contentType}:${contentId}`;
  const stateItem = useSelector((s: RootState) => s.engagement.items?.[k]);
  const item = useMemo(() => {
    if (stateItem) {
      return {
        threadedByMe: stateItem.threadedByMe ?? !!initialThreaded,
        threadCount: stateItem.threadCount ?? initialCount
      };
    }
    return {
      threadedByMe: !!initialThreaded,
      threadCount: initialCount
    };
  }, [stateItem, initialThreaded, initialCount]);
  // const initKeyRef = useRef<string | null>(null); // no longer needed
  const me = useSelector((s: RootState) => s.user.profile?.id);
  const realtime = useRealtime();
  
  // Prevent race conditions from overlapping requests
  const pendingRequestRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const pendingActionsCount = useRef(0);

  useEffect(() => {
  // Establish realtime joins & subscriptions
    // Always join the room to get real-time updates
  const { joinCollection, joinCollectionMedia, onThread } = realtime;
  if (contentType === 'COLLECTION') joinCollection(contentId);
  else if (contentType === 'COLLECTION_MEDIA') joinCollectionMedia(contentId);

    // If initialThreaded is provided, we can immediately set the state and avoid a fetch.
    if (initialThreaded !== undefined) {
      dispatch(setThreadState({
        contentType,
        contentId,
        threadedByMe: initialThreaded,
        threadCount: initialCount,
      }));
      setInitializing(false);
    } else if (isAuth) {
      // Fetch only if the initial state is unknown and user is logged in.
      setInitializing(true);
      const fetchApi = contentType === 'COLLECTION_MEDIA'
        ? ReactionsApi.getCollectionMediaIsThreaded
        : ReactionsApi.getCollectionIsThreaded;

      fetchApi(contentId)
        .then(threadStatus => {
          dispatch(setThreadState({
            contentType,
            contentId,
            threadedByMe: !!threadStatus.threaded,
            threadCount: initialCount, // Count is fetched separately or comes from props
          }));
        })
        .catch(() => {
          // On failure, fallback to the initial prop values.
          dispatch(setThreadState({
            contentType,
            contentId,
            threadedByMe: false, // Assume not threaded on error
            threadCount: initialCount,
          }));
        })
        .finally(() => setInitializing(false));
    } else {
      // Not authenticated and no initial value, so set to default.
      dispatch(setThreadState({
        contentType,
        contentId,
        threadedByMe: false,
        threadCount: initialCount,
      }));
      setInitializing(false);
    }

  const unsub = onThread(contentType, contentId, (p: any) => {
      if (p.contentType === contentType && p.contentId === contentId) {
        dispatch(wsApplied({ contentType, contentId, threadCount: p.threadCount }));
        if (p.userId && me && ownerId && ownerId === me && p.userId !== me && p.threadCount > item.threadCount) {
          toast.info('Someone threaded your content!');
        }
      }
    });
    return () => {
      unsub();
      
      // Clean up any pending request when component unmounts or key changes
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
        pendingRequestRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId, dispatch, isAuth, initialCount, initialThreaded, ownerId]);

  const toggle = async () => {
    // Prevent multiple simultaneous requests - strict deduplication
    // Limit to 3 concurrent actions to prevent spam/flicker
    if (pendingActionsCount.current >= 3 || initializing) {
      return; 
    }

    // Show toast and abort if user is not authenticated
    if (!isAuth) {
      toast.info('Please sign in to thread items.');
      return;
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    pendingRequestRef.current = abortController;
    pendingActionsCount.current += 1;

    // Increment version to track request order
    const thisRequestVersion = ++requestVersionRef.current;

    const next = !item.threadedByMe;
    const previousThreadCount = item.threadCount;
    dispatch(optimisticToggle({ contentType, contentId, nextThreaded: next }));
    // Optimistically bump aggregated collection threads if threading media
    if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
      const delta = next ? 1 : -1;
      dispatch(adjustAggregatedCollectionThreads({ collectionId: parentCollectionId, delta }));
    }
    setBusy(true);

    try {
      let res: { threads: number };

      if (contentType === 'COLLECTION') {
        res = await ReactionsApi.toggleCollectionThread(contentId);
      } else {
        res = await ReactionsApi.toggleCollectionMediaThread(contentId);
      }

      // Only reconcile if this is still the latest request
      // This prevents stale responses from overwriting newer state
      if (thisRequestVersion === requestVersionRef.current &&
          pendingRequestRef.current === abortController) {
        dispatch(reconcile({
          contentType,
          contentId,
          threadCount: res.threads,
          threadedByMe: next
        }));
        if (next) {
          setShowThreadBurst(true);
          window.setTimeout(() => setShowThreadBurst(false), 650);
        }
        // Reconcile aggregated collection threads using actual delta if media thread
        if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
          const delta = res.threads - previousThreadCount;
          if (delta !== (next ? 1 : -1)) {
            // Adjust difference between optimistic and actual delta
            const correction = delta - (next ? 1 : -1);
            if (correction !== 0) {
              dispatch(adjustAggregatedCollectionThreads({ collectionId: parentCollectionId, delta: correction }));
            }
          }
        }
      }
    } catch (err: any) {
      // Don't handle aborted requests
      if (err.name === 'AbortError') {
        return;
      }

      // Only revert if this is still the latest request and not aborted
      if (thisRequestVersion === requestVersionRef.current &&
          pendingRequestRef.current === abortController) {
        if (!navigator.onLine) {
          // Queue toggle for offline handling (collection or media)
          if (contentType === 'COLLECTION') {
            OfflineThreads.enqueueCollectionToggle(contentId);
          } else if (contentType === 'COLLECTION_MEDIA') {
            OfflineThreads.enqueueCollectionMediaToggle(contentId);
          }
          // Keep optimistic state; reconciliation will happen on flush
        } else {
          // Revert optimistic update on error
          dispatch(optimisticToggle({ contentType, contentId, nextThreaded: !next }));
          // Roll back optimistic aggregation if media thread failed
          if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
            const rollbackDelta = next ? -1 : 1;
            dispatch(adjustAggregatedCollectionThreads({ collectionId: parentCollectionId, delta: rollbackDelta }));
          }
        }
      }
    } finally {
      // Clean up request tracking only if this is the current request
      if (pendingRequestRef.current === abortController) {
        pendingRequestRef.current = null;
      }
      pendingActionsCount.current = Math.max(0, pendingActionsCount.current - 1);
      setBusy(false);
    }
  };

  return (
    <div className={`relative flex flex-col items-center ${className ?? ''}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
        disabled={busy && pendingActionsCount.current >= 3}
        aria-label={item.threadedByMe ? "Unthread" : "Thread"}
        className={`transition-transform disabled:opacity-60 disabled:cursor-not-allowed hover:scale-110 ${
          busy ? 'animate-pulse' : ''
        }`}
      >
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center text-base"
        >
          <span
            aria-hidden="true"
            className={`${busy ? 'animate-[spin_1.2s_linear_infinite]' : ''} ${item.threadedByMe ? 'drop-shadow-[0_0_8px_rgba(147,51,234,0.65)]' : ''}`}
          >
            🧵
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-bold drop-shadow text-white hover:text-rose-300 transition-colors mt-1"
        aria-label={`View ${item.threadCount ?? 0} threads`}
      >
        {item.threadCount ?? 0}
      </button>
      {showThreadBurst && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-3 text-xs animate-bounce"
        >
          ✨🧵
        </span>
      )}
      <ThreadListModal
        open={open}
        onClose={() => setOpen(false)}
        contentId={contentId}
        contentType={contentType}
      />
    </div>
  );
};

export default ThreadButton;

