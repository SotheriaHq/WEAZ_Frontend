import React from 'react';
import { useSearchParams } from 'react-router-dom';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import { useQueryClient } from '@tanstack/react-query';
import type { CommentV2Dto } from '@/types/comments';
import { CommentsApi } from '@/api/CommentsApi';
import { OfflineComments } from '@/lib/offlineComments';
import CommentItem from '@/components/comments/CommentItem';
import CommentInput from '@/components/ui/CommentInput';
import {
  fetchCommentRepliesQuery,
  fetchUnifiedCollectionCommentsQuery,
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
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasNext, setHasNext] = React.useState(false);
  const [text, setText] = React.useState('');
  const [postedOk, setPostedOk] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const errorToastShown = React.useRef(false);
  const commentNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [searchParams] = useSearchParams();
  const highlightCommentId = searchParams.get('commentId');
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

  /**
   * ONE request for the whole design.
   *
   * This used to fan out to two endpoints — COLLECTION_MEDIA:<current slide> and
   * COLLECTION:<design> — and merge them. That was wrong twice over:
   *
   *  1. Comments are posted against the media item that was on screen when they
   *     were written, but the panel only ever asked for the CURRENT slide. A
   *     shopper who commented on slide 3 was invisible to a brand opening at
   *     slide 1 — which is exactly what "the notification routed me to the
   *     content but the comments were not displayed" was.
   *  2. Any single failure of the pair fired "Some comments could not be
   *     loaded", so a routine 404 on one leg nagged on every single open.
   *
   * `comments-unified` returns COLLECTION + every COLLECTION_MEDIA under it in
   * one authorized, cursor-paged query, so the design has one comment stream
   * regardless of which angle is showing, and there is no partial state to
   * apologise for.
   */
  const loadInitial = async (forceRefresh = false) => {
    setBusy(true);
    try {
      const res = await fetchUnifiedCollectionCommentsQuery(queryClient, collectionId, {
        limit: 20,
        forceRefresh,
      });
      const list = Array.isArray(res.items) ? res.items : [];
      setItems(list);
      dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: list.length }));
      list.forEach((c) => joinComment(c.id));
      setCursor(res.endCursor);
      setHasNext(res.hasNextPage);
      errorToastShown.current = false;
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
    if (busy || !hasNext) return;
    setBusy(true);
    try {
      const res = await fetchUnifiedCollectionCommentsQuery(queryClient, collectionId, {
        cursor,
        limit: 20,
      });
      const more = Array.isArray(res.items) ? res.items : [];
      const next = mergeAndSort(items ?? [], more);
      setItems(next);
      dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
      more.forEach((c) => joinComment(c.id));
      setCursor(res.endCursor);
      setHasNext(res.hasNextPage);
    } catch {
      /* keep what we already have */
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    setItems([]); setCursor(null); setHasNext(false);
    void loadInitial();
    joinCollectionMedia(mediaId);
    joinCollection(collectionId);

    // The stream is now design-wide, so one handler serves both rooms: patch
    // optimistically for instant feedback, and invalidate the unified page so
    // the next open reads fresh.
    const applyEvent = (p: any) => {
      if (!p?.commentId) return;
      invalidateCommentListQueries(queryClient, p.targetType, p.targetId);
      invalidateUnifiedCollectionCommentsQuery(queryClient, collectionId);

      const isDelete = !p.comment && (p.deleted || p.event === 'comment.deleted');
      if (isDelete) {
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== p.commentId);
          if (next.length !== prev.length) {
            onCommentRemoved?.();
            dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
          }
          return next;
        });
        return;
      }

      if (!p.comment) return;
      setItems((prev) => {
        if (prev.some((c) => c.id === p.commentId)) return prev;
        // Replies belong under their parent, never as a new top-level row.
        if (p.comment.parentId) {
          const parentId = p.comment.parentId as string;
          return prev.map((c) =>
            c.id === parentId
              ? { ...c, replyCount: (c.replyCount ?? 0) + 1, children: c.children && c.children.length > 0 ? [p.comment, ...c.children] : c.children }
              : c,
          );
        }
        const next = [p.comment, ...prev];
        onCommentAdded?.();
        joinComment(p.commentId);
        dispatch(updateCommentCount({ contentType: 'COLLECTION_MEDIA', contentId: mediaId, commentCount: next.length }));
        return next;
      });
    };

    const unsubMedia = onComment(`COLLECTION_MEDIA:${mediaId}`, applyEvent);
    const unsubCollection = onComment(`COLLECTION:${collectionId}`, applyEvent);
    return () => { unsubMedia(); unsubCollection(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, collectionId]);

  /**
   * Deep-link target from a comment notification (`?commentId=`).
   *
   * The notification already routes here; without this the brand landed on the
   * design with no idea which comment they were sent to look at.
   */
  React.useEffect(() => {
    if (!highlightCommentId || !items.length) return;
    const node = commentNodeRefs.current[highlightCommentId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ring-2', 'ring-fuchsia-400');
    const timer = window.setTimeout(
      () => node.classList.remove('ring-2', 'ring-fuchsia-400'),
      2200,
    );
    return () => window.clearTimeout(timer);
  }, [highlightCommentId, items]);

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
      {/* List — scrolls inline, no frame of its own; the modal supplies the surface. */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-wiez overscroll-contain pr-1">
        <div className="space-y-1">
          {items.map((c) => (
            <div
              key={c.id}
              ref={(node) => { commentNodeRefs.current[c.id] = node; }}
              className="rounded-xl py-1.5 transition-shadow"
            >
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
          {!items.length && !busy && (
            <div className="flex min-h-[160px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-2 text-2xl opacity-70" aria-hidden="true">💬</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white">No comments yet</div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Start the conversation below.</div>
            </div>
          )}
        </div>
        {hasNext && (
          <div className="pt-2">
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-fuchsia-700 transition hover:bg-fuchsia-500/10 disabled:opacity-50 dark:text-fuchsia-300"
              onClick={() => void loadMore()}
              disabled={busy}
            >
              {busy ? 'Loading…' : 'Load more comments'}
            </button>
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
