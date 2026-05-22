import React from 'react';
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

  const { onComment, joinCollection, joinCollectionMedia } = useRealtime();
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




