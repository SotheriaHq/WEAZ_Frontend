import React, { useEffect, useRef, useMemo } from 'react';
import { Heart } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { optimisticToggle, reconcile, setLikeState, wsApplied, adjustAggregatedCollectionLikes } from '@/features/engagementSlice';
import { ReactionsApi } from '@/api/ReactionsApi';
import { useRealtime } from '@/realtime';
import LikerListModal from '@/components/engagement/LikerListModal';
import { OfflineLikes } from '@/lib/offlineLikes';
import { toast } from 'react-toastify';

type ContentType = 'COLLECTION' | 'COLLECTION_MEDIA';

type Props = {
  contentType: ContentType;
  contentId: string;
  initialCount?: number;
  initialLiked?: boolean;
  className?: string;
  size?: number;
  ownerId?: string;
  parentCollectionId?: string; // For COLLECTION_MEDIA likes aggregation
};

const LikeButton: React.FC<Props> = ({ 
  contentType, 
  contentId, 
  initialCount = 0, 
  initialLiked, 
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
  const k = `${contentType}:${contentId}`;
  const stateItem = useSelector((s: RootState) => s.engagement.items?.[k]);
  const item = useMemo(() => {
    if (stateItem) {
      return {
        likedByMe: stateItem.likedByMe ?? !!initialLiked,
        likeCount: stateItem.likeCount ?? initialCount
      };
    }
    return {
      likedByMe: !!initialLiked,
      likeCount: initialCount
    };
  }, [stateItem, initialLiked, initialCount]);
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
  const { joinCollection, joinCollectionMedia, onLike } = realtime;
  if (contentType === 'COLLECTION') joinCollection(contentId);
  else if (contentType === 'COLLECTION_MEDIA') joinCollectionMedia(contentId);

    // If initialLiked is provided, we can immediately set the state and avoid a fetch.
    if (initialLiked !== undefined) {
      dispatch(setLikeState({
        contentType,
        contentId,
        likedByMe: initialLiked,
        likeCount: initialCount,
      }));
      setInitializing(false);
    } else if (isAuth) {
      // Fetch only if the initial state is unknown and user is logged in.
      setInitializing(true);
      const fetchApi = contentType === 'COLLECTION_MEDIA'
        ? ReactionsApi.getCollectionMediaIsLiked
        : ReactionsApi.getCollectionIsLiked;

      fetchApi(contentId)
        .then(likeStatus => {
          dispatch(setLikeState({
            contentType,
            contentId,
            likedByMe: !!likeStatus.liked,
            likeCount: initialCount, // Count is fetched separately or comes from props
          }));
        })
        .catch(() => {
          // On failure, fallback to the initial prop values.
          dispatch(setLikeState({
            contentType,
            contentId,
            likedByMe: false, // Assume not liked on error
            likeCount: initialCount,
          }));
        })
        .finally(() => setInitializing(false));
    } else {
      // Not authenticated and no initial value, so set to default.
      dispatch(setLikeState({
        contentType,
        contentId,
        likedByMe: false,
        likeCount: initialCount,
      }));
      setInitializing(false);
    }

  const unsub = onLike(contentType, contentId, (p: any) => {
      if (p.contentType === contentType && p.contentId === contentId) {
        dispatch(wsApplied({ contentType, contentId, likeCount: p.likeCount }));
        if (p.userId && me && ownerId && ownerId === me && p.userId !== me && p.likeCount > item.likeCount) {
          toast.info('Someone liked your content!');
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
  }, [contentType, contentId, dispatch, isAuth, initialCount, initialLiked, ownerId]);

  const toggle = async () => {
    // Prevent multiple simultaneous requests - strict deduplication
    // Limit to 3 concurrent actions to prevent spam/flicker
    if (pendingActionsCount.current >= 3 || initializing) {
      return; 
    }

    // Show toast and abort if user is not authenticated
    if (!isAuth) {
      toast.info('Please sign in to like items.');
      return;
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    pendingRequestRef.current = abortController;
    pendingActionsCount.current += 1;

    // Increment version to track request order
    const thisRequestVersion = ++requestVersionRef.current;

    const next = !item.likedByMe;
    const previousLikeCount = item.likeCount;
    dispatch(optimisticToggle({ contentType, contentId, nextLiked: next }));
    // Optimistically bump aggregated collection likes if liking media
    if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
      const delta = next ? 1 : -1;
      dispatch(adjustAggregatedCollectionLikes({ collectionId: parentCollectionId, delta }));
    }
    setBusy(true);

    try {
      let res: { likes: number };

      if (contentType === 'COLLECTION') {
        res = await ReactionsApi.toggleCollectionLike(contentId);
      } else {
        res = await ReactionsApi.toggleCollectionMediaLike(contentId);
      }

      // Only reconcile if this is still the latest request
      // This prevents stale responses from overwriting newer state
      if (thisRequestVersion === requestVersionRef.current &&
          pendingRequestRef.current === abortController) {
        dispatch(reconcile({
          contentType,
          contentId,
          likeCount: res.likes,
          likedByMe: next
        }));
        // Reconcile aggregated collection likes using actual delta if media like
        if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
          const delta = res.likes - previousLikeCount;
          if (delta !== (next ? 1 : -1)) {
            // Adjust difference between optimistic and actual delta
            const correction = delta - (next ? 1 : -1);
            if (correction !== 0) {
              dispatch(adjustAggregatedCollectionLikes({ collectionId: parentCollectionId, delta: correction }));
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
            OfflineLikes.enqueueCollectionToggle(contentId);
          } else if (contentType === 'COLLECTION_MEDIA') {
            OfflineLikes.enqueueCollectionMediaToggle(contentId);
          }
          // Keep optimistic state; reconciliation will happen on flush
        } else {
          // Revert optimistic update on error
          dispatch(optimisticToggle({ contentType, contentId, nextLiked: !next }));
          // Roll back optimistic aggregation if media like failed
          if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
            const rollbackDelta = next ? -1 : 1;
            dispatch(adjustAggregatedCollectionLikes({ collectionId: parentCollectionId, delta: rollbackDelta }));
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
    <div className={`flex flex-col items-center ${className ?? ''}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
        disabled={busy && pendingActionsCount.current >= 3}
        aria-label={item.likedByMe ? "Unlike" : "Like"}
        className={`transition-transform disabled:opacity-60 disabled:cursor-not-allowed hover:scale-110 ${
          busy ? 'animate-pulse' : ''
        }`}
      >
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center"
        >
          <Heart
            className={`transition-colors duration-200 ${
              item.likedByMe
                ? 'fill-red-600 text-red-600'
                : 'fill-transparent text-white'
            }`}
            width={size}
            height={size}
          />
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-bold drop-shadow text-white hover:text-rose-300 transition-colors mt-1"
        aria-label={`View ${item.likeCount ?? 0} likes`}
      >
        {item.likeCount ?? 0}
      </button>
      <LikerListModal
        open={open}
        onClose={() => setOpen(false)}
        contentId={contentId}
        contentType={contentType}
      />
    </div>
  );
};

export default LikeButton;

