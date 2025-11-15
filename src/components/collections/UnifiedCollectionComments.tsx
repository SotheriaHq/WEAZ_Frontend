import React from 'react';
import { CommentsApi } from '@/api/CommentsApi';
import type { CommentV2Dto } from '@/types/comments';
import CommentInput from '@/components/ui/CommentInput';
import { Smile } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
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
  const [text, setText] = React.useState('');
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

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
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {items.map((c) => (
          <div key={c.id} className="py-0.5">
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
      <div className="sticky bottom-0 pt-2 border-t border-gray-200 dark:border-white/20">
        <div className="relative">
          <CommentInput
          value={text}
          onChange={setText}
          onSubmit={async () => {
            const content = text.trim();
            if (!content) return;
            setBusy(true);
            try {
              const created = await CommentsApi.create('COLLECTION', collectionId, content);
              setText('');
              applyCreated(created);
            } catch (e: any) {
              toast.error(e?.response?.data?.message ?? 'Failed to post comment');
            } finally { setBusy(false); }
          }}
          disabled={busy}
          busy={busy}
            placeholder="Add a comment..."
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker((p) => !p)}
          className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <Smile size={18} />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50 w-56 max-h-64 overflow-y-auto rounded-lg shadow-xl bg-black/80 border border-white/10 p-1">
            <div style={{ width: 224, height: 256 }}>
              <EmojiPicker
                onEmojiClick={(e: EmojiClickData) => { setText((prev) => prev + e.emoji); setShowEmojiPicker(false); }}
                emojiStyle={EmojiStyle.NATIVE}
                theme={Theme.DARK}
                searchDisabled
                skinTonesDisabled
                lazyLoadEmojis
              />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedCollectionComments;
