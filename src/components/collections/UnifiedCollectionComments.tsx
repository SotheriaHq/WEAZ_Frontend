import React from 'react';
import { CommentsApi } from '@/api/CommentsApi';
import type { CommentV2Dto } from '@/types/comments';
import CommentComposer from '@/components/comments/CommentComposer';
import CommentItem from '@/components/comments/CommentItem';
import { toast } from 'react-toastify';

interface Props {
  collectionId: string;
}

const UnifiedCollectionComments: React.FC<Props> = ({ collectionId }) => {
  const [items, setItems] = React.useState<CommentV2Dto[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasNext, setHasNext] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = async (reset = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await CommentsApi.listUnifiedForCollection(collectionId, reset ? undefined : cursor ?? undefined, 20);
      if (reset) setItems(res.items); else setItems((prev) => [...prev, ...res.items]);
      setHasNext(res.hasNextPage);
      setCursor(res.endCursor);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to load comments');
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => { setItems([]); setCursor(null); setHasNext(false); void load(true); }, [collectionId]);

  const applyCreated = (c: CommentV2Dto) => setItems((prev) => [c, ...prev]);
  const handleLike = (commentId: string, likeCount: number) => setItems((prev) => prev.map((c) => c.id === commentId ? { ...c, likeCount } : { ...c, children: c.children?.map(r => r.id === commentId ? { ...r, likeCount } : r) }));
  const handleDelete = (commentId: string) => setItems((prev) => prev.filter((c) => c.id !== commentId).map((c) => ({ ...c, children: c.children?.filter(r => r.id !== commentId) })));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {items.map((c) => (
          <div key={c.id} className="py-1.5">
            <div className="flex items-center gap-1 pb-0.5">
              <span className="inline-block text-[9px] px-1 py-0.5 rounded bg-white/30 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                {c.targetType === 'COLLECTION' ? 'collection' : 'item'}
              </span>
            </div>
            <CommentItem comment={c} onLike={handleLike} onDelete={handleDelete} onReply={() => {}} />
            {c.children && c.children.length > 0 && (
              <div className="pl-8 mt-0.5 space-y-1">
                {c.children.map((r) => (
                  <CommentItem key={r.id} comment={r} onLike={handleLike} onDelete={handleDelete} onReply={() => {}} />
                ))}
              </div>
            )}
          </div>
        ))}
        {!items.length && <div className="text-xs text-gray-500 py-4">Be the first to comment.</div>}
        {hasNext && (
          <div className="py-2 text-center">
            <button type="button" className="px-2 py-1.5 text-[11px] rounded bg-white/30 dark:bg-white/10 border border-white/30" onClick={() => load(false)} disabled={busy}>Load more</button>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 pt-2 border-t border-white/20">
        <CommentComposer targetType="COLLECTION" targetId={collectionId} onCreated={applyCreated} />
      </div>
    </div>
  );
};

export default UnifiedCollectionComments;
