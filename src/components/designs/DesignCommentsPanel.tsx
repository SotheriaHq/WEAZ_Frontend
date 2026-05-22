import React from 'react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import { useQueryClient } from '@tanstack/react-query';
import type { CommentV2Dto } from '@/types/comments';
import { CommentsApi } from '@/api/CommentsApi';
import { OfflineComments } from '@/lib/offlineComments';
import CommentItem from '@/components/comments/CommentItem';
import CommentInput from '@/components/ui/CommentInput';
import {
  fetchCommentListQuery,
  fetchCommentRepliesQuery,
  invalidateCommentListQueries,
  invalidateUnifiedCollectionCommentsQuery,
} from '@/query/queries';
import { useRealtime } from '@/realtime';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import { updateCommentCount } from '@/features/engagementSlice';

type Props = {
  mediaId: string;
  collectionId: string;
  className?: string;
  onCountChange?: (count: number) => void; // Deprecated: use onCommentAdded/Removed
  onCommentAdded?: () => void;
  onCommentRemoved?: () => void;
  showComposer?: boolean;
  contentOwnerId?: string; // brand/content owner for delete gating
  currentUserId?: string; // viewer id
  externalComment?: CommentV2Dto | null;
};

const DesignCommentsPanel: React.FC<Props> = ({
  mediaId,
  collectionId,
  className,
  onCommentAdded,
  onCommentRemoved,
  showComposer = true,
  contentOwnerId,
  currentUserId,
  externalComment,
}) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
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
  const { joinCollection, joinCollectionMedia, joinComment, onComment, degraded } = useRealtime();

  const mergeAndSort = (a: CommentV2Dto[], b: CommentV2Dto[]) => {
    const merged = [...a, ...b];
    merged.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
    // Cap list to avoid excessive DOM nodes
    return merged.slice(0, 400);
  };

  React.useEffect(() => {
    if (!externalComment) return;
    let inserted = false;
    setItems((prev) => {
      if (prev.some((comment) => comment.id === externalComment.id)) return prev;
      inserted = true;
      return [externalComment, ...prev];
    });
    if (!inserted) return;
    onCommentAdded?.();
    joinComment(externalComment.id);
    dispatch(updateCommentCount({
      contentType: 'COLLECTION_MEDIA',
      contentId: mediaId,
      commentCount: items.length + 1,
    }));
  }, [dispatch, externalComment, items.length, joinComment, mediaId, onCommentAdded]);

  const loadInitial = async (forceRefresh = false) => {
    setBusy(true);
    try {
      // Fetch sources independently so one failure doesn't blank the list
      const mediaReq = fetchCommentListQuery(queryClient, 'COLLECTION_MEDIA', mediaId, { limit: 20, forceRefresh })
        .then((r) => ({ ok: true as const, r }))
        .catch((e) => ({ ok: false as const, e }));
      const collReq = fetchCommentListQuery(queryClient, 'COLLECTION', collectionId, { limit: 20, forceRefresh })
        .then((r) => ({ ok: true as const, r }))
        .catch((e) => ({ ok: false as const, e }));
      const [mediaRes, collRes] = await Promise.all([mediaReq, collReq]);

  const mediaItemsRaw = mediaRes.ok ? mediaRes.r.items : [];
  const collItemsRaw = collRes.ok ? collRes.r.items : [];
  const mediaItems = Array.isArray(mediaItemsRaw) ? mediaItemsRaw : [];
  const collItems = Array.isArray(collItemsRaw) ? collItemsRaw : [];
  const merged = mergeAndSort(mediaItems, collItems);
  setItems(merged);
  // onCountChange?.(merged.length); // Removed to prevent overwriting total count with partial count
  // Normalize global comment count for the media item to reflect combined view
  dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: merged.length }));
    // Join comment rooms for realtime thread updates
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
        ? fetchCommentListQuery(queryClient, 'COLLECTION_MEDIA', mediaId, { cursor: mediaCursor, limit: 20 }).then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const }))
        : Promise.resolve({ ok: false as const });
      const collReq = collHasNext
        ? fetchCommentListQuery(queryClient, 'COLLECTION', collectionId, { cursor: collCursor, limit: 20 }).then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const }))
        : Promise.resolve({ ok: false as const });
      const [mediaRes, collRes] = await Promise.all([mediaReq, collReq]);
  const moreMediaRaw = mediaRes.ok ? mediaRes.r.items : [];
    const moreCollRaw = collRes.ok ? collRes.r.items : [];
    const moreMedia = Array.isArray(moreMediaRaw) ? moreMediaRaw : [];
    const moreColl = Array.isArray(moreCollRaw) ? moreCollRaw : [];
    const next = mergeAndSort([...(items ?? []), ...moreMedia], moreColl);
      setItems(next);
      // onCountChange?.(next.length); // Removed
  dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
      if (mediaRes.ok) { setMediaCursor(mediaRes.r.endCursor); setMediaHasNext(mediaRes.r.hasNextPage); }
      if (collRes.ok) { setCollCursor(collRes.r.endCursor); setCollHasNext(collRes.r.hasNextPage); }
    } catch {}
    finally { setBusy(false); }
  };

  React.useEffect(() => {
    setItems([]); setMediaCursor(null); setCollCursor(null); setMediaHasNext(false); setCollHasNext(false);
    void loadInitial();
    joinCollectionMedia(mediaId);
    joinCollection(collectionId);
    // Incremental patching for comment events
    const unsubMedia = onComment(`COLLECTION_MEDIA:${mediaId}`, (p: any) => {
      // New comment created
      if (p.comment && p.commentId && p.targetType === 'COLLECTION_MEDIA' && p.targetId === mediaId) {
        invalidateCommentListQueries(queryClient, 'COLLECTION_MEDIA', mediaId);
        invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
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
          onCommentAdded?.();
          joinComment(p.commentId);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      } else if (!p.comment && p.commentId && p.targetType === 'COLLECTION_MEDIA' && p.targetId === mediaId && (p.deleted || p.event === 'comment.deleted')) {
        invalidateCommentListQueries(queryClient, 'COLLECTION_MEDIA', mediaId);
        invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== p.commentId);
          onCommentRemoved?.();
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      }
    });
    const unsubCollection = onComment(`COLLECTION:${collectionId}`, (p: any) => {
      if (p.comment && p.commentId && p.targetType === 'COLLECTION' && p.targetId === collectionId) {
        invalidateCommentListQueries(queryClient, 'COLLECTION', collectionId);
        invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
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
          onCommentAdded?.();
          joinComment(p.commentId);
          dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          return next;
        });
      }
      if (!p.comment && p.commentId && p.targetType === 'COLLECTION' && p.targetId === collectionId && (p.deleted || p.event === 'comment.deleted')) {
        invalidateCommentListQueries(queryClient, 'COLLECTION', collectionId);
        invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== p.commentId);
          onCommentRemoved?.();
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
      void loadInitial(true);
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
        onCommentAdded?.();
      } else {
        const created = await CommentsApi.create('COLLECTION_MEDIA', mediaId, content);
        setText('');
        setPostedOk(true);
        setTimeout(() => setPostedOk(false), 1200);
        invalidateCommentListQueries(queryClient, 'COLLECTION_MEDIA', mediaId);
        invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
        setItems((prev) => {
          const next = [created, ...prev];
          onCommentAdded?.();
          return next;
        });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setBusy(false); }
  };

  const loadReplies = async (parentId: string) => {
    try {
      const res = await fetchCommentRepliesQuery(queryClient, parentId, { limit: 20 });
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
                  invalidateCommentListQueries(queryClient, c.targetType, c.targetId);
                  invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);
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
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 text-center dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 text-2xl" aria-hidden="true">💬</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">No comments yet</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Start the conversation from the comment box below.</div>
            </div>
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
            placeholder="Add a comment..."
            className=""
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker((p) => !p)}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <span aria-hidden="true" className="text-base">🙂</span>
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
              <span aria-hidden="true" className="text-base">✅</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DesignCommentsPanel;
