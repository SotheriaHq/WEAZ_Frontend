import React from 'react';
import { X, Smile, Send } from 'lucide-react';
import type { MarketItem } from '@/types/market';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
import { formatPrice } from '@/utils/helpers';
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';



type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
};

const DesignViewModal: React.FC<Props> = ({ open, item, onClose, onCommentCountChange }) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [commentCount, setCommentCount] = React.useState<number>(0);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [commentText, setCommentText] = React.useState('');
  const [postingComment, setPostingComment] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const currentUserId = useSelector((s: RootState) => s.user.profile?.id);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setCommentText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  // Sync comment count when item changes
  React.useEffect(() => {
    if (item) {
      setCommentCount(item.commentsCount ?? 0);
    }
  }, [item]);

  React.useEffect(() => {
    if (open) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [open]);

  // Guard rendering until item is available to avoid null property access.
  if (!open || !item) return null;

  const baseBand = (() => {
    const min = typeof item?.minPrice === 'number' ? formatPrice(item.minPrice) : undefined;
    const max = typeof item?.maxPrice === 'number' ? formatPrice(item.maxPrice) : undefined;
    if (min && max) return `${min} – ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return null;
  })();
  const saleBand = (() => {
    const min = typeof (item as any)?.saleMinPrice === 'number' ? formatPrice((item as any).saleMinPrice) : undefined;
    const max = typeof (item as any)?.saleMaxPrice === 'number' ? formatPrice((item as any).saleMaxPrice) : undefined;
    if (min && max) return `${min} – ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const brandLabel = item.brandName ?? item.username ?? 'Brand';

  const handleCommentSubmit = async () => {
    if (!isAuth) { toast.info('Please sign in to comment.'); return; }
    const content = commentText.trim();
    if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
    setPostingComment(true);
    try {
      await CommentsApi.create('COLLECTION_MEDIA', item.id, content);
      setCommentText('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setPostingComment(false); }
  };

  // (Handled earlier)

  // --- Custom Styles from Mockup ---
  
  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          ref={dialogRef}
          className="relative w-[95vw] md:w-[70vw] max-w-[840px] bg-white text-slate-900 dark:bg-[#0a0a0a]/90 dark:text-white rounded-xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-black/40 dark:bg-white/10 text-white hover:bg-black/60 dark:hover:bg-white/20 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="grid md:grid-cols-[55%_45%] h-full">
            {/* Media column */}
            <div className="bg-black h-[82vh] md:h-[90vh] w-full overflow-y-auto scrollbar-hide">
              <MediaRenderer
                kind={item.media?.type?.toUpperCase().includes('VIDEO') ? 'video' : 'image'}
                src={item.media.url || ''}
                className="w-full"
                mediaClassName="w-full h-auto block"
                maxHeightClassName=""
                maxWidthClassName=""
                allowScroll={false}
                controls={false}
              />
            </div>

            {/* Info / actions */}
            <div className="h-[82vh] md:h-[90vh] overflow-y-auto p-4 md:p-5 space-y-4 bg-white/90 text-slate-900 dark:bg-[#0f0b11]/80 dark:text-white scrollbar-hide">
              {/* Brand + title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-lg font-bold text-white">
                    {brandLabel.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{brandLabel}</p>
                    {item.username && <p className="text-xs text-slate-500 dark:text-white/50">@{item.username}</p>}
                  </div>
                </div>
                <button className="text-[11px] px-3 py-1 rounded-full bg-purple-600 text-white font-medium hover:bg-purple-700 transition">Follow</button>
              </div>

              <div>
                <h1 className="text-lg font-bold leading-tight mb-0.5 text-slate-900 dark:text-white">{item.collectionTitle}</h1>
                {item.collectionDescription && (
                  <p className="text-[12px] text-slate-500 dark:text-white/60 leading-relaxed">{item.collectionDescription}</p>
                )}
              </div>

              {/* Tags */}
              {item.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-white/40 text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:bg-white/10 dark:text-white">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Price */}
              <div className="py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/30 inline-block">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{saleBand || baseBand || 'Price on request'}</p>
                {saleBand && baseBand && <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60 line-through">{baseBand}</p>}
              </div>

              {/* Action buttons - compact with colors */}
              <div className="flex flex-wrap gap-1.5">
                <button className="rounded-md px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-semibold hover:opacity-90 transition shadow-sm">🛒 Add to Cart</button>
                <button className="rounded-md px-2.5 py-1.5 bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold hover:bg-rose-200 transition dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700/40">💜 Save</button>
                <button className="rounded-md px-2.5 py-1.5 bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold hover:bg-sky-200 transition dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700/40">🔗 Share</button>
                <button className="rounded-md px-2.5 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-semibold hover:bg-amber-200 transition dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/40">🏬 Store</button>
              </div>

              {/* Comments */}
              <DesignCommentsPanel
                mediaId={item.id}
                collectionId={item.collectionId}
                contentOwnerId={item.brandId}
                currentUserId={currentUserId}
                onCommentAdded={() => setCommentCount((c) => c + 1)}
                onCommentRemoved={() => setCommentCount((c) => Math.max(0, c - 1))}
                showComposer={false}
              />

              {/* Comment input with emoji picker */}
              <div className="relative sticky bottom-0">
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-slate-200 dark:bg-transparent dark:border-white/15">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCommentSubmit()}
                    disabled={postingComment}
                    placeholder="Share your thoughts..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
                  />
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1 text-slate-400 hover:text-purple-600 dark:text-white/40 dark:hover:text-purple-400 transition"
                    aria-label="Emoji"
                    type="button"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={handleCommentSubmit}
                    disabled={postingComment || !commentText.trim()}
                    className="p-1.5 rounded-full bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                </div>
                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                    <div className="relative z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme={Theme.DARK}
                        height={320}
                        width={280}
                        searchDisabled
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DesignViewModal;

