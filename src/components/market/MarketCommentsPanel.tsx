import React from 'react';
import { CheckCircle2, Smile } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import type { CommentV2Dto } from '@/types/comments';
import { CommentsApi } from '@/api/CommentsApi';
import { OfflineComments } from '@/lib/offlineComments';
import CommentItem from '@/components/comments/CommentItem';
import CommentInput from '@/components/ui/CommentInput';
import { useRealtime } from '@/realtime';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'react-toastify';
import { updateCommentCount } from '@/features/engagementSlice';

type Props = {
  mediaId: string;
  collectionId: string;
  className?: string;
  onCountChange?: (count: number) => void;
  showComposer?: boolean;
  contentOwnerId?: string; // brand/content owner for delete gating
  currentUserId?: string; // viewer id
};

const MarketCommentsPanel: React.FC<Props> = ({ mediaId, collectionId, className, onCountChange, showComposer = true, contentOwnerId, currentUserId }) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const dispatch = useDispatch();
  const [items, setItems] = React.useState<CommentV2Dto[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [mediaCursor, setMediaCursor] = React.useState<string | null>(null);
  const [collCursor, setCollCursor] = React.useState<string | null>(null);
  const [mediaHasNext, setMediaHasNext] = React.useState(false);
  const [collHasNext, setCollHasNext] = React.useState(false);
  const [text, setText] = React.useState('');
  const [postedOk, setPostedOk] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const errorToastShown = React.useRef(false);

  const mergeAndSort = (a: CommentV2Dto[], b: CommentV2Dto[]) => {
    const merged = [...a, ...b];
    merged.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
    // Cap list to avoid excessive DOM nodes
    return merged.slice(0, 400);
  };

  const loadInitial = async () => {
    setBusy(true);
    try {
      // Fetch sources independently so one failure doesn't blank the list
      const mediaReq = CommentsApi.list('COLLECTION_MEDIA', mediaId, undefined, 20)
        .then((r) => ({ ok: true as const, r }))
        .catch((e) => ({ ok: false as const, e }));
      const collReq = CommentsApi.list('COLLECTION', collectionId, undefined, 20)
        .then((r) => ({ ok: true as const, r }))
        .catch((e) => ({ ok: false as const, e }));
      const [mediaRes, collRes] = await Promise.all([mediaReq, collReq]);

  const mediaItemsRaw = mediaRes.ok ? mediaRes.r.items : [];
  const collItemsRaw = collRes.ok ? collRes.r.items : [];
  const mediaItems = Array.isArray(mediaItemsRaw) ? mediaItemsRaw : [];
  const collItems = Array.isArray(collItemsRaw) ? collItemsRaw : [];
  const merged = mergeAndSort(mediaItems, collItems);
  setItems(merged);
  onCountChange?.(merged.length);
  // Normalize global comment count for the media item to reflect combined view
  dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: merged.length }));
    // Join comment rooms for realtime like updates
    merged.forEach((c) => joinComment(c.id));

      if (mediaRes.ok) {
        setMediaCursor(mediaRes.r.endCursor);
        setMediaHasNext(mediaRes.r.hasNextPage);
      }
      if (collRes.ok) {
        setCollCursor(collRes.r.endCursor);
        setCollHasNext(collRes.r.hasNextPage);
      }

      // Per-source error notices, non-blocking
      if (!mediaRes.ok || !collRes.ok) {
        if (!errorToastShown.current) {
          toast.error('Some comments could not be loaded. Showing available comments.');
          errorToastShown.current = true;
        }
      } else {
        errorToastShown.current = false;
      }
    } catch {
      if (!errorToastShown.current) {
        toast.error('Failed to load comments');
        errorToastShown.current = true;
      }
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (busy || (!mediaHasNext && !collHasNext)) return;
    setBusy(true);
    try {
      const mediaReq = mediaHasNext
        ? CommentsApi.list('COLLECTION_MEDIA', mediaId, mediaCursor ?? undefined, 20).then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const }))
        : Promise.resolve({ ok: false as const });
      const collReq = collHasNext
        ? CommentsApi.list('COLLECTION', collectionId, collCursor ?? undefined, 20).then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const }))
        : Promise.resolve({ ok: false as const });
      const [mediaRes, collRes] = await Promise.all([mediaReq, collReq]);
  const moreMediaRaw = mediaRes.ok ? mediaRes.r.items : [];
    const moreCollRaw = collRes.ok ? collRes.r.items : [];
    const moreMedia = Array.isArray(moreMediaRaw) ? moreMediaRaw : [];
    const moreColl = Array.isArray(moreCollRaw) ? moreCollRaw : [];
    const next = mergeAndSort([...(items ?? []), ...moreMedia], moreColl);
      setItems(next);
      onCountChange?.(next.length);
  dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
      if (mediaRes.ok) { setMediaCursor(mediaRes.r.endCursor); setMediaHasNext(mediaRes.r.hasNextPage); }
      if (collRes.ok) { setCollCursor(collRes.r.endCursor); setCollHasNext(collRes.r.hasNextPage); }
    } catch {}
    finally { setBusy(false); }
  };

  const { joinCollection, joinCollectionMedia, joinComment, onComment, degraded } = useRealtime();
  React.useEffect(() => {
    setItems([]); setMediaCursor(null); setCollCursor(null); setMediaHasNext(false); setCollHasNext(false);
    void loadInitial();
    joinCollectionMedia(mediaId);
    joinCollection(collectionId);
    // Incremental patching for comment events
    const unsubMedia = onComment(`COLLECTION_MEDIA:${mediaId}`, (p: any) => {
      // New comment created
      if (p.comment && p.commentId && p.targetType === 'COLLECTION_MEDIA' && p.targetId === mediaId) {
        const isReply = !!p.comment.parentId;
        setItems((prev) => {
          if (prev.some((c) => c.id === p.commentId)) return prev;
          if (isReply) {
            // Update parent only (avoid showing reply as a new top-level item)
            const parentId = p.comment.parentId as string;
            return prev.map((c) =>
              c.id === parentId
                ? { ...c, replyCount: (c.replyCount ?? 0) + 1, children: c.children && c.children.length > 0 ? [p.comment, ...c.children] : c.children }
                : c
            );
          }
          const next = [p.comment, ...prev];
          onCountChange?.(next.length);
          joinComment(p.commentId);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      } else if (!p.comment && p.commentId && p.targetType === 'COLLECTION_MEDIA' && p.targetId === mediaId && (p.deleted || p.event === 'comment.deleted')) {
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== p.commentId);
          onCountChange?.(next.length);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      }
    });
    const unsubCollection = onComment(`COLLECTION:${collectionId}`, (p: any) => {
      if (p.comment && p.commentId && p.targetType === 'COLLECTION' && p.targetId === collectionId) {
        const isReply = !!p.comment.parentId;
        setItems((prev) => {
          if (prev.some((c) => c.id === p.commentId)) return prev;
          if (isReply) {
            const parentId = p.comment.parentId as string;
            return prev.map((c) =>
              c.id === parentId
                ? { ...c, replyCount: (c.replyCount ?? 0) + 1, children: c.children && c.children.length > 0 ? [p.comment, ...c.children] : c.children }
                : c
            );
          }
          const next = [p.comment, ...prev];
          onCountChange?.(next.length);
          joinComment(p.commentId);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      }
      if (!p.comment && p.commentId && p.targetType === 'COLLECTION' && p.targetId === collectionId && (p.deleted || p.event === 'comment.deleted')) {
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== p.commentId);
          onCountChange?.(next.length);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      }
    });
    return () => { unsubMedia(); unsubCollection(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, collectionId]);

  // Polling fallback when realtime is degraded
  React.useEffect(() => {
    if (!degraded) return;
    const id = setInterval(() => {
      void loadInitial();
    }, 20000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [degraded, mediaId, collectionId]);

  const submit = async () => {
    if (!isAuth) { toast.info('Please sign in to comment.'); return; }
    const content = text.trim();
    if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
    setBusy(true);
    try {
      if (!navigator.onLine) {
        const optimistic = OfflineComments.enqueue('COLLECTION_MEDIA', mediaId, content);
        setText('');
        setPostedOk(true);
        setTimeout(() => setPostedOk(false), 1200);
        setItems((prev) => [optimistic, ...prev]);
        onCountChange?.((items?.length ?? 0) + 1);
      } else {
        const created = await CommentsApi.create('COLLECTION_MEDIA', mediaId, content);
        setText('');
        setPostedOk(true);
        setTimeout(() => setPostedOk(false), 1200);
        setItems((prev) => {
          const next = [created, ...prev];
          onCountChange?.(next.length);
          return next;
        });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setBusy(false); }
  };

  const loadReplies = async (parentId: string) => {
    try {
      const res = await CommentsApi.replies(parentId, undefined, 20);
      setItems((prev) => prev.map((c) => c.id === parentId ? { ...c, children: res.items } : c));
    } catch {}
  };

  // Track collapsed/expanded replies per comment
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleReplies = async (parentId: string, replyCount: number) => {
    setExpanded((e) => ({ ...e, [parentId]: !e[parentId] }));
    // Lazy load on first expand if no children yet but count exists
    const parent = items.find((c) => c.id === parentId);
    if (parent && !parent.children && replyCount > 0) {
      await loadReplies(parentId);
    }
  };

  function onEmojiClick(emojiData: EmojiClickData) {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  }

  return (
    <div className={`flex h-full flex-col ${className ?? ''}`}>
      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pr-1">
        <div className="space-y-1">
          {items.map((c) => (
            <div key={c.id} className="py-1.5">
              <CommentItem
                comment={c}
                onReply={loadReplies}
                currentUserId={currentUserId}
                contentOwnerId={contentOwnerId}
                enableReplyComposer
                onCreateReply={async (parentId, content) => {
                  const created = await CommentsApi.create(c.targetType, c.targetId, content, parentId);
                  // Insert reply locally under parent
                  setItems((prev) => prev.map((it) => it.id === parentId ? { ...it, children: [created, ...(it.children ?? [])], replyCount: (it.replyCount ?? 0) + 1 } : it));
                  // Auto-expand on posting
                  setExpanded((e) => ({ ...e, [parentId]: true }));
                }}
              />
              {/* Replies toggler */}
              {c.replyCount > 0 && (
                <button
                  type="button"
                  className="ml-10 mt-1 text-[12px] text-purple-600 hover:text-purple-700 dark:text-purple-300"
                  onClick={() => void toggleReplies(c.id, c.replyCount)}
                >
                  {expanded[c.id] ? `Hide replies (${c.replyCount})` : `View replies (${c.replyCount})`}
                </button>
              )}
              {expanded[c.id] && c.children && c.children.length > 0 && (
                <div className="mt-0.5 space-y-1 pl-10">
                  {c.children.map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      onReply={loadReplies}
                      currentUserId={currentUserId}
                      contentOwnerId={contentOwnerId}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {!items.length && (
            <div className="py-6 text-sm text-gray-600 dark:text-gray-400">Be the first to comment.</div>
          )}
        </div>
        {(mediaHasNext || collHasNext) && (
          <div className="pt-2">
            <button type="button" className="rounded bg-white/20 px-3 py-2 text-sm" onClick={() => void loadMore()} disabled={busy}>Load more</button>
          </div>
        )}
      </div>

      {/* Composer pinned bottom – styled for visibility on light panel */}
      {showComposer && (
        <div className="mt-2 relative">
          <CommentInput
            value={text}
            onChange={setText}
            onSubmit={submit}
            disabled={busy}
            busy={busy}
            placeholder="Share your thoughts..."
            className=""
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker((p) => !p)}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Smile size={18} />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2 z-50 scrollbar-hide">
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                emojiStyle={EmojiStyle.NATIVE}
                theme={Theme.DARK}
                searchDisabled
                skinTonesDisabled
                lazyLoadEmojis
              />
            </div>
          )}
          {postedOk && (
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-emerald-500">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>
      )}
      {degraded && (
        <div className="mt-2 rounded bg-amber-100 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          Real-time connection degraded. Changes may appear with delay.
        </div>
      )}
    </div>
  );
};

export default MarketCommentsPanel;
