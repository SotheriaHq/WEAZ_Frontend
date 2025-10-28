import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CommentV2Dto } from '@/types/comments';
import { CommentsApi } from '@/api/CommentsApi';
import CommentItem from '@/components/comments/CommentItem';
import CommentInput from '@/components/ui/CommentInput';
import { getSocket, joinContentRoom } from '@/lib/ws';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'react-toastify';

type Props = {
  mediaId: string;
  collectionId: string;
  className?: string;
  onCountChange?: (count: number) => void;
  showComposer?: boolean;
};

const MarketCommentsPanel: React.FC<Props> = ({ mediaId, collectionId, className, onCountChange, showComposer = true }) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [items, setItems] = React.useState<CommentV2Dto[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [mediaCursor, setMediaCursor] = React.useState<string | null>(null);
  const [collCursor, setCollCursor] = React.useState<string | null>(null);
  const [mediaHasNext, setMediaHasNext] = React.useState(false);
  const [collHasNext, setCollHasNext] = React.useState(false);
  const [text, setText] = React.useState('');
  const [postedOk, setPostedOk] = React.useState(false);

  const mergeAndSort = (a: CommentV2Dto[], b: CommentV2Dto[]) => {
    const merged = [...a, ...b];
    merged.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
    return merged;
  };

  const loadInitial = async () => {
    setBusy(true);
    try {
      const [mediaRes, collRes] = await Promise.all([
        CommentsApi.list('COLLECTION_MEDIA', mediaId, undefined, 20),
        CommentsApi.list('COLLECTION', collectionId, undefined, 20),
      ]);
      const merged = mergeAndSort(mediaRes.items, collRes.items);
      setItems(merged);
      onCountChange?.(merged.length);
      setMediaCursor(mediaRes.endCursor);
      setCollCursor(collRes.endCursor);
      setMediaHasNext(mediaRes.hasNextPage);
      setCollHasNext(collRes.hasNextPage);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to load comments');
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (busy || (!mediaHasNext && !collHasNext)) return;
    setBusy(true);
    try {
      const [mediaRes, collRes] = await Promise.all([
        mediaHasNext ? CommentsApi.list('COLLECTION_MEDIA', mediaId, mediaCursor ?? undefined, 20) : Promise.resolve(null as any),
        collHasNext ? CommentsApi.list('COLLECTION', collectionId, collCursor ?? undefined, 20) : Promise.resolve(null as any),
      ]);
      const moreMedia = mediaRes ? mediaRes.items : [];
      const moreColl = collRes ? collRes.items : [];
      const next = mergeAndSort([...(items ?? []), ...moreMedia], moreColl);
      setItems(next);
      onCountChange?.(next.length);
      if (mediaRes) { setMediaCursor(mediaRes.endCursor); setMediaHasNext(mediaRes.hasNextPage); }
      if (collRes) { setCollCursor(collRes.endCursor); setCollHasNext(collRes.hasNextPage); }
    } catch {}
    finally { setBusy(false); }
  };

  React.useEffect(() => {
    setItems([]); setMediaCursor(null); setCollCursor(null); setMediaHasNext(false); setCollHasNext(false);
    void loadInitial();
    joinContentRoom('COLLECTION_MEDIA', mediaId);
    joinContentRoom('COLLECTION', collectionId);
    const s = getSocket();
    const onCreated = (p: any) => {
      if ((p?.targetType === 'COLLECTION_MEDIA' && p?.targetId === mediaId) || (p?.targetType === 'COLLECTION' && p?.targetId === collectionId)) {
        // Just reload the first page to keep cursors consistent
        void loadInitial();
      }
    };
    const onDeleted = onCreated;
    s.on('comment.created', onCreated);
    s.on('comment.deleted', onDeleted);
    return () => { s.off('comment.created', onCreated); s.off('comment.deleted', onDeleted); };
  }, [mediaId, collectionId]);

  const submit = async () => {
    if (!isAuth) { toast.info('Please sign in to comment.'); return; }
    const content = text.trim();
    if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
    setBusy(true);
    try {
      const created = await CommentsApi.create('COLLECTION_MEDIA', mediaId, content);
      setText('');
      setPostedOk(true);
      setTimeout(() => setPostedOk(false), 1200);
      setItems((prev) => {
        const next = [created, ...prev];
        onCountChange?.(next.length);
        return next;
      });
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

  return (
    <div className={`flex h-full flex-col ${className ?? ''}`}>
      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="divide-y divide-white/20">
          {items.map((c) => (
            <div key={c.id} className="py-3">
              <CommentItem comment={c} onReply={loadReplies} />
              {c.children && c.children.length > 0 && (
                <div className="mt-1 space-y-2 pl-10">
                  {c.children.map((r) => (
                    <CommentItem key={r.id} comment={r} onReply={loadReplies} />
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
        <div className="mt-3">
          <CommentInput
            value={text}
            onChange={setText}
            onSubmit={submit}
            disabled={busy}
            busy={busy}
          />
          {postedOk && (
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-emerald-500">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketCommentsPanel;
