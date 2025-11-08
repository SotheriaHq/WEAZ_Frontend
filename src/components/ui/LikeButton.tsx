import React, { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { optimisticToggle, reconcile, setLikeState, wsApplied } from '@/features/engagementSlice';
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
};

const LikeButton: React.FC<Props> = ({ 
  contentType, 
  contentId, 
  initialCount = 0, 
  initialLiked, 
  className, 
  size = 20,
  ownerId,
}) => {
  const dispatch = useDispatch();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  const k = `${contentType}:${contentId}`;
  const item = useSelector((s: RootState) => {
    const stateItem = s.engagement.likes[k];
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
  });
  // const initKeyRef = useRef<string | null>(null); // no longer needed
  const me = useSelector((s: RootState) => s.user.profile?.id);
  const realtime = useRealtime();
  
  // Prevent race conditions from overlapping requests
  const pendingRequestRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);

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
    if (busy || pendingRequestRef.current || initializing) {
      return; // Silently ignore duplicate requests and prevent interaction during initialization
    }

    // Prevent toggling during initialization to avoid state conflicts
    if (initializing) {
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

    // Increment version to track request order
    const thisRequestVersion = ++requestVersionRef.current;

    const next = !item.likedByMe;
    dispatch(optimisticToggle({ contentType, contentId, nextLiked: next }));
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
          // Queue only collection toggles for offline handling
          if (contentType === 'COLLECTION') {
            OfflineLikes.enqueueCollectionToggle(contentId);
          }
          // Keep optimistic state; reconciliation will happen on flush
        } else {
          // Revert optimistic update on error
          dispatch(optimisticToggle({ contentType, contentId, nextLiked: !next }));
        }
      }
    } finally {
      // Clean up request tracking only if this is the current request
      if (pendingRequestRef.current === abortController) {
        pendingRequestRef.current = null;
      }
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
        disabled={busy}
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
                ? 'fill-rose-500 text-rose-500'
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

