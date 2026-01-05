import React from 'react';
import { X, Share2, MessageCircle, Plus, CheckCircle2, Smile } from 'lucide-react';
import type { MarketItem } from '@/types/market';
import MediaViewer from '@/components/media/MediaViewer';
import LikeButton from '@/components/ui/LikeButton';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
import Tag from '@/components/ui/Tag';
import { IconButton } from '@/components/ui/FrostedButton';
import CommentInput from '@/components/ui/CommentInput';
import { formatPrice } from '@/utils/helpers';
import { getTagColor } from '@/utils/tagColors';
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import { useCountdown } from '@/hooks/useCountdown';
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
  const [commentPosted, setCommentPosted] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const currentUserId = useSelector((s: RootState) => s.user.profile?.id);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  
  // Calculate sale end time for countdown (always call hook)
  const saleEndTime = React.useMemo(() => {
    if (!item) return undefined;
    const now = Date.now();
    const hasValidSale = item.saleMinPrice || item.saleMaxPrice;
    const startOk = !item.saleStartAt || new Date(item.saleStartAt).getTime() <= now;
    const endOk = !item.saleEndAt || new Date(item.saleEndAt).getTime() >= now;
    const saleActive = Boolean(hasValidSale && startOk && endOk);
    return saleActive ? item.saleEndAt ?? undefined : undefined;
  }, [item]);
  
  const { label: countdownLabel, expired } = useCountdown(saleEndTime);

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

  function onEmojiClick(emojiData: EmojiClickData) {
    setCommentText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false);
  }

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

  const saleActive = Boolean(saleEndTime); // Sale is active if saleEndTime is defined
  const brandLabel = item.brandName ?? item.username ?? 'Brand';

  // Two-section modal: left (media) and right (data + comments)
  const leftColsSm = 'sm:col-span-12';
  const leftColsMd = 'md:col-span-6';
  const rightColsSm = 'sm:col-span-12';
  const rightColsMd = 'md:col-span-6';

  const handleCommentSubmit = async () => {
    if (!isAuth) { toast.info('Please sign in to comment.'); return; }
    const content = commentText.trim();
    if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
    setPostingComment(true);
    try {
      await CommentsApi.create('COLLECTION_MEDIA', item.id, content);
      setCommentText('');
      setCommentPosted(true);
      setTimeout(() => setCommentPosted(false), 1200);
      // setCommentCount(prev => prev + 1); // Rely on realtime via MarketCommentsPanel
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setPostingComment(false); }
  };

  // (Handled earlier)

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-layer-modal flex items-stretch justify-center"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Design details"
      >
        {/* Unified gradient blur backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
        <div className="absolute inset-0 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-black/40" />
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative m-4 grid h-[90vh] w-[95%] max-w-6xl grid-cols-12 gap-0 rounded-2xl bg-white/5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Left: Media - full width with vertical scroll for tall images */}
        <div className={`col-span-12 ${leftColsSm} ${leftColsMd} rounded-l-2xl bg-black overflow-y-auto overscroll-contain`}> 
          <div className="relative mx-auto w-full">
            <MediaViewer
              media={item.media}
              rounded={false}
              objectFit="contain"
              className="!w-full !h-auto rounded-l-2xl"
            />
          </div>
        </div>

        {/* Right: Data Area + Comments */}
      <div className={`col-span-12 flex flex-col p-4 ${rightColsSm} ${rightColsMd} overflow-y-auto modal-scrollbar relative bg-white/60 dark:bg-white/5 backdrop-blur-xl border-l border-white/20 dark:border-white/10 rounded-r-2xl text-gray-900 dark:text-gray-100 overscroll-contain` }>
          {/* Data Area */}
          <div className="pb-4">
            <div className="mb-3 flex items-center gap-3">
              {item.brandLogo ? (
                <div className="max-h-10 max-w-10 overflow-hidden rounded-full text-white">
                  <MediaRenderer
                    kind="image"
                    src={item.brandLogo}
                    alt={brandLabel}
                    maxHeightClassName="max-h-10"
                    maxWidthClassName="max-w-10"
                    className="rounded-full"
                    mediaClassName="rounded-full"
                  />
                </div>
              ) : (
                <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-purple-500 text-white">
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                    {(brandLabel.charAt(0) || 'B').toUpperCase()}
                  </div>
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{brandLabel}</div>
                {item.username && item.brandName !== item.username && (
                  <div className="truncate text-xs text-gray-600 dark:text-gray-300">@{item.username}</div>
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">{item.collectionTitle}</h3>
            {item.collectionDescription && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200 line-clamp-4 leading-relaxed">
                {item.collectionDescription}
              </p>
            )}

            {/* Tags */}
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 5).map((tag) => {
                  const color = getTagColor(tag);
                  return <Tag key={tag} label={`#${tag}`} size="sm" color={color} />;
                })}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-4">
              {/* Pass initialLiked to avoid an extra authenticated fetch in the modal */}
              <LikeButton
                contentType="COLLECTION_MEDIA"
                contentId={item.id}
                initialCount={item.likesCount ?? 0}
                initialLiked={item.isLiked}
                ownerId={item.brandId}
                parentCollectionId={item.collectionId}
              />
              <IconButton variant="ghost" size="sm" icon={<Share2 size={16} />} onClick={() => { /* TODO: share */ }} tooltip="Share" />
              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <MessageCircle size={16} />
                <span className="font-medium">{commentCount}</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {(saleBand && baseBand) ? (
                  <div className="flex flex-col items-end gap-1">
                    {/* Base price container with rounded edges */}
                    <span className="rounded-lg px-2 py-1 text-[12px] line-through text-gray-500 bg-white/50 dark:bg-white/10 border border-gray-300 dark:border-gray-600">{baseBand}</span>
                    {/* Sale price container with background and rounded edges */}
                    <span className="rounded-lg px-2 py-1 text-[12px] text-white font-semibold bg-emerald-600 dark:bg-emerald-700 border border-emerald-700 dark:border-emerald-800 shadow-sm">{saleBand}</span>
                  </div>
                ) : baseBand ? (
                  <span className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-white/10 border border-gray-300 dark:border-gray-600">{baseBand}</span>
                ) : null}
                {/* Countdown indicator (compact) */}
                {saleActive && !expired && countdownLabel && (
                  <span className="rounded-md bg-rose-600/90 text-white text-[11px] font-semibold px-2 py-0.5 border border-white/20 shadow-sm" title="Sale ends">
                    {countdownLabel}
                  </span>
                )}
                <IconButton variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => { /* TODO: cart */ }} tooltip="Add to cart" />
              </div>
            </div>
          </div>

          {/* Comments Area */}
          <div className="min-h-0 flex-1 pt-3 mt-3 flex flex-col">
            <DesignCommentsPanel
              mediaId={item.id}
              collectionId={item.collectionId}
              contentOwnerId={item.brandId}
              currentUserId={currentUserId}
              onCommentAdded={() => {
                setCommentCount((prev) => {
                  const next = prev + 1;
                  onCommentCountChange?.(next);
                  return next;
                });
              }}
              onCommentRemoved={() => {
                setCommentCount((prev) => {
                  const next = Math.max(0, prev - 1);
                  onCommentCountChange?.(next);
                  return next;
                });
              }}
              showComposer={false}
            />
            {/* Inline Comment Input (sticky) */}
            <div className="sticky bottom-0 left-0 right-0 z-10 mt-3 pt-2 bg-transparent">
              <CommentInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={handleCommentSubmit}
                disabled={postingComment}
                busy={postingComment}
                placeholder="Share your thoughts..."
              />
              {/* Emoji Toggle Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                aria-label="Toggle emoji picker"
              >
                <Smile size={18} />
              </button>

              {commentPosted && (
                <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-emerald-500">
                  <CheckCircle2 size={18} />
                </div>
              )}

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="fixed inset-0 z-20" onClick={() => setShowEmojiPicker(false)}>
                  {/* click-catcher */}
                </div>
              )}
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-30">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    autoFocusSearch={false}
                    emojiStyle={EmojiStyle.APPLE}
                    theme={Theme.LIGHT}
                    lazyLoadEmojis
                    /* Make more rows visible by collapsing header/search and preview */
                    searchDisabled
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                    height={360}
                    className="glass-emoji-picker"
                  />
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

