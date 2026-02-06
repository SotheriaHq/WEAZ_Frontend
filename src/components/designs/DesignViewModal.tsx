import React from 'react';
import { X } from 'lucide-react';
import type { MarketItem } from '@/types/market';
// MediaViewer removed
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
// Tag, IconButton removed
import CommentInput from '@/components/ui/CommentInput';
import { formatPrice } from '@/utils/helpers';
// getTagColor removed
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';



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
  const currentUserId = useSelector((s: RootState) => s.user.profile?.id);
  const dialogRef = React.useRef<HTMLDivElement>(null);

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
            className="absolute top-3 right-3 z-50 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X />
          </button>

          <div className="grid md:grid-cols-[50%_50%] h-full">
            {/* Media column */}
            <div className="bg-black h-[82vh] md:h-[90vh] w-full overflow-y-auto scrollbar-hide">
              <MediaRenderer
                kind={item.media?.type?.toUpperCase().includes('VIDEO') ? 'video' : 'image'}
                src={item.media.url || ''}
                className="w-full h-auto min-h-full"
                mediaClassName="w-full h-auto block"
                controls={false}
              />
            </div>

            {/* Info / actions */}
            <div className="h-[82vh] md:h-[90vh] overflow-y-auto p-4 md:p-5 space-y-4 bg-white/90 text-slate-900 dark:bg-[#0f0b11]/80 dark:text-white scrollbar-hide">
              {/* Brand + title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-lg font-bold">
                    {brandLabel.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{brandLabel}</p>
                    {item.username && <p className="text-xs text-white/60">@{item.username}</p>}
                  </div>
                </div>
                <button className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 transition">Follow</button>
              </div>

              <div>
                <h1 className="text-xl font-semibold leading-tight mb-1">{item.collectionTitle}</h1>
                {item.collectionDescription && (
                  <p className="text-[13px] text-slate-600 dark:text-white/70 leading-relaxed">{item.collectionDescription}</p>
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
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                <p className="text-sm font-semibold">{saleBand || baseBand || 'Price on request'}</p>
                {saleBand && baseBand && <p className="text-[11px] text-slate-500 dark:text-white/50 line-through">{baseBand}</p>}
              </div>

              {/* Emoji action row */}
              <div className="flex flex-wrap gap-2">
                <button className="flex-1 min-w-[120px] rounded-lg px-3 py-2 bg-slate-100 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition dark:bg-white/10 dark:border-white/10 dark:hover:bg-white/15">🛒 Add to Cart</button>
                <button className="rounded-lg px-3 py-2 bg-slate-100 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition dark:bg-white/10 dark:border-white/10 dark:hover:bg-white/15">💜 Save</button>
                <button className="rounded-lg px-3 py-2 bg-slate-100 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition dark:bg-white/10 dark:border-white/10 dark:hover:bg-white/15">🔗 Share</button>
                <button className="rounded-lg px-3 py-2 bg-slate-100 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition dark:bg-white/10 dark:border-white/10 dark:hover:bg-white/15">🏬 View in Store</button>
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

              {/* Comment input with send emoji */}
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 dark:bg-white/10 dark:border-white/10 sticky bottom-0">
                <CommentInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleCommentSubmit}
                  disabled={postingComment}
                  busy={postingComment}
                  placeholder="Share your thoughts..."
                  className="!bg-transparent !border-none !p-0 flex-1 !text-sm"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={postingComment || !commentText.trim()}
                  className="text-lg disabled:opacity-40"
                  aria-label="Send"
                >
                  📨
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DesignViewModal;

