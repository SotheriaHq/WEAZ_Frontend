import React, { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { optimisticToggle, reconcile, setLikeState, wsApplied } from '@/features/engagementSlice';
import { ReactionsApi } from '@/api/ReactionsApi';
import { getSocket, joinContentRoom } from '@/lib/ws';
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
};

const LikeButton: React.FC<Props> = ({ contentType, contentId, initialCount = 0, initialLiked, className, size = 20 }) => {
  const dispatch = useDispatch();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const k = `${contentType}:${contentId}`;
  const item = useSelector((s: RootState) => s.engagement.likes[k] ?? { likedByMe: !!initialLiked, likeCount: initialCount });
  const initKeyRef = useRef<string | null>(null);
  // Current user id for self-event reconciliation and to filter ws count updates
  const me = useSelector((s: RootState) => s.user.profile?.id);

  useEffect(() => {
    const thisKey = `${contentType}:${contentId}`;
    const firstInitForKey = initKeyRef.current !== thisKey;

    // Join room on every key change
    joinContentRoom(contentType, contentId);

    // Initialize state only once per key to avoid flicker from prop resets
    if (firstInitForKey) {
      initKeyRef.current = thisKey;
      dispatch(setLikeState({ contentType, contentId, likedByMe: !!initialLiked, likeCount: initialCount }));
      // fetch isLiked if not provided and user is authenticated
      if (isAuth && (initialLiked === undefined)) {
        if (contentType === 'COLLECTION_MEDIA') {
          ReactionsApi.getCollectionMediaIsLiked(contentId)
            .then(r => dispatch(setLikeState({ contentType, contentId, likedByMe: !!r.liked, likeCount: initialCount })))
            .catch(() => void 0);
        } else if (contentType === 'COLLECTION') {
          ReactionsApi.getCollectionIsLiked(contentId)
            .then(r => dispatch(setLikeState({ contentType, contentId, likedByMe: !!r.liked, likeCount: initialCount })))
            .catch(() => void 0);
        }
      }
    }

    const s = getSocket();
    const onLikeCreated = (p: any) => {
      if (p.contentType === contentType && p.contentId === contentId) {
        if (p.userId === me) {
          dispatch(reconcile({ contentType, contentId, likeCount: p.likeCount, likedByMe: true }));
        } else {
          dispatch(wsApplied({ contentType, contentId, likeCount: p.likeCount }));
        }
      }
    };
    const onLikeRemoved = (p: any) => {
      if (p.contentType === contentType && p.contentId === contentId) {
        if (p.userId === me) {
          dispatch(reconcile({ contentType, contentId, likeCount: p.likeCount, likedByMe: false }));
        } else {
          dispatch(wsApplied({ contentType, contentId, likeCount: p.likeCount }));
        }
      }
    };
    s.on('like.created', onLikeCreated);
    s.on('like.removed', onLikeRemoved);
    return () => {
      s.off('like.created', onLikeCreated);
      s.off('like.removed', onLikeRemoved);
    };
  }, [contentType, contentId, dispatch, isAuth, me]);

  const toggle = async () => {
    if (busy) return;
    // Show toast and abort if user is not authenticated
    if (!isAuth) {
      toast.info('Please sign in to like items.');
      return;
    }

    const next = !item.likedByMe;
    dispatch(optimisticToggle({ contentType, contentId, nextLiked: next }));
    setBusy(true);
    try {
      if (contentType === 'COLLECTION') {
        const res = await ReactionsApi.toggleCollectionLike(contentId);
        dispatch(reconcile({ contentType, contentId, likeCount: res.likes, likedByMe: next }));
      } else {
        const res = await ReactionsApi.toggleCollectionMediaLike(contentId);
        dispatch(reconcile({ contentType, contentId, likeCount: res.likes, likedByMe: next }));
      }
    } catch (err) {
      if (!navigator.onLine) {
        // Queue only collection toggles; for media, keep optimistic and rely on user retry on reconnect
        if (contentType === 'COLLECTION') OfflineLikes.enqueueCollectionToggle(contentId);
        // keep optimistic state; reconciliation will happen on flush
      } else {
        dispatch(optimisticToggle({ contentType, contentId, nextLiked: !next }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-1 ${className ?? ''}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void toggle(); }}
        disabled={busy}
        aria-label="Like"
        className={`transition-transform disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <div style={{ width: size, height: size }} className="flex items-center justify-center">
          <Heart
            className={`${item.likedByMe ? 'fill-rose-500 text-rose-500' : 'fill-transparent text-white'}`}
            width={size}
            height={size}
          />
        </div>
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="text-xs font-bold drop-shadow text-white">
        {item.likeCount}
      </button>
      <LikerListModal open={open} onClose={() => setOpen(false)} contentId={contentId} contentType={contentType} />
    </div>
  );
};

export default LikeButton;




