import React, { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CommentTarget, CommentV2Dto } from '@/types/comments';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import {
  fetchCommentListQuery,
  fetchCommentRepliesQuery,
  invalidateCommentListQueries,
} from '@/query/queries';
import { useRealtime } from '@/realtime';
import { toast } from 'sonner';

type Props = {
  targetType: CommentTarget;
  targetId: string;
  className?: string;
};

const CommentThread: React.FC<Props> = ({ targetType, targetId, className }) => {
  const queryClient = useQueryClient();
  const [items, setItems] = React.useState<CommentV2Dto[]>([]);
  const [hasNext, setHasNext] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = async (reset = false, forceRefresh = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetchCommentListQuery(queryClient, targetType, targetId, {
        cursor: reset ? null : cursor,
        limit: 20,
        forceRefresh,
      });
      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setHasNext(res.hasNextPage);
      setCursor(res.endCursor);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to load comments');
    } finally {
      setBusy(false);
    }
  };

  // Keep for potential per-user room routing; currently not used
  // const me = useSelector((s: RootState) => s.user.profile?.id);

  const { onComment, joinCollection, joinCollectionMedia, joinComment } = useRealtime();
  React.useEffect(() => {
    setItems([]); setCursor(null); setHasNext(false);
    void load(true);
    // Join appropriate room via provider
    if (targetType === 'COLLECTION') joinCollection(targetId);
    else if (targetType === 'COLLECTION_MEDIA') joinCollectionMedia(targetId);
    const unsubscribeCreated = onComment(`${targetType}:${targetId}`, (p) => {
      if (p?.contentType === targetType && p?.contentId === targetId && p?.event !== 'comment.deleted') {
        invalidateCommentListQueries(queryClient, targetType, targetId);
        void load(true, true);
      }
    });
    const unsubscribeDeleted = onComment(`${targetType}:${targetId}`, (p) => {
      if (p?.contentType === targetType && p?.contentId === targetId && p?.event === 'comment.deleted') {
        invalidateCommentListQueries(queryClient, targetType, targetId);
        void load(true, true);
      }
    });
    return () => {
      unsubscribeCreated();
      unsubscribeDeleted();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  /**
   * Pull a comment's replies again and merge them in.
   *
   * Used by the realtime subscription below; `loadReplies` is the user-initiated
   * "show replies" path and also resets other UI, which is not what a background
   * update should do.
   */
  const refreshRepliesFor = useCallback(
    async (parentId: string) => {
      try {
        const res = await fetchCommentRepliesQuery(queryClient, parentId, { limit: 20 });
        setItems((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, children: res.items, threadCount: res.items.length }
              : c,
          ),
        );
      } catch {
        // A missed refresh is not worth interrupting the reader for; the next
        // event or a manual expand will pick it up.
      }
    },
    [queryClient],
  );

  /**
   * Replies arrive in their PARENT COMMENT's room, not the target's.
   *
   * The subscription above joins `COLLECTION:`/`COLLECTION_MEDIA:` and catches
   * new top-level comments. Replies are published to `COMMENT:<parentId>` — a
   * room this component never joined — so a brand's reply reached the shopper's
   * toast (that rides the user notification channel) while the thread they were
   * looking at showed nothing. Being notified of a reply you cannot see, in the
   * exact view where it belongs, is worse than not being told at all.
   */
  useEffect(() => {
    const parentIds = items.map((item) => item.id).filter(Boolean);
    if (parentIds.length === 0) return;

    const unsubscribes = parentIds.map((parentId) => {
      joinComment(parentId);
      return onComment(`COMMENT:${parentId}`, (payload) => {
        if (payload?.event === 'comment.deleted') {
          void refreshRepliesFor(parentId);
          return;
        }
        void refreshRepliesFor(parentId);
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    // Keyed on the ID LIST, not the item objects: re-subscribing every time a
    // count or a like changes would churn the socket for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((item) => item.id).join(','), joinComment, onComment, refreshRepliesFor]);

  const applyCreated = (c: CommentV2Dto) => {
    invalidateCommentListQueries(queryClient, c.targetType, c.targetId);
    setItems((prev) => [c, ...prev]);
  };

  const handleThread = (commentId: string, threadCount: number) => {
    setItems((prev) => prev.map((c) => c.id === commentId ? { ...c, threadCount } : { ...c, children: c.children?.map(r => r.id === commentId ? { ...r, threadCount } : r) }));
  };

  const handleDelete = (commentId: string) => {
    invalidateCommentListQueries(queryClient, targetType, targetId);
    setItems((prev) => prev.filter((c) => c.id !== commentId).map((c) => ({ ...c, children: c.children?.filter(r => r.id !== commentId) })));
  };

  const loadReplies = async (parentId: string) => {
    try {
      const res = await fetchCommentRepliesQuery(queryClient, parentId, { limit: 20 });
      setItems((prev) => prev.map((c) => c.id === parentId ? { ...c, children: res.items } : c));
    } catch {}
  };

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <CommentComposer targetType={targetType} targetId={targetId} onCreated={applyCreated} />
      <div className="divide-y divide-white/20">
        {items.map((c) => (
          <div key={c.id} className="py-3">
            <CommentItem comment={c} onThread={handleThread} onReply={loadReplies} onDelete={handleDelete} />
            {/* Children */}
            {c.children && c.children.length > 0 && (
              <div className="pl-10 mt-1 space-y-2">
                {c.children.map((r) => (
                  <CommentItem key={r.id} comment={r} onThread={handleThread} onReply={loadReplies} onDelete={handleDelete} />
                ))}
              </div>
            )}
            {c.replyCount > (c.children?.length ?? 0) && (
              <button type="button" onClick={() => loadReplies(c.id)} className="text-xs text-primary px-10 py-1">View all {c.replyCount} replies</button>
            )}
          </div>
        ))}
        {!items.length && <div className="text-sm text-gray-500 py-6">Be the first to comment.</div>}
      </div>
      {hasNext && (
        <div className="pt-2">
          <button type="button" className="px-3 py-2 text-sm rounded bg-white/20 border border-white/30" onClick={() => load(false)} disabled={busy}>Load more</button>
        </div>
      )}
    </div>
  );
};

export default CommentThread;




