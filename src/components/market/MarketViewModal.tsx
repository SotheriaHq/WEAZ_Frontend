import React from 'react';
import { X, Share2, MessageCircle, Plus, CheckCircle2, Smile } from 'lucide-react';
import type { MarketItem } from '@/types/market';
import MediaViewer from '@/components/media/MediaViewer';
import LikeButton from '@/components/ui/LikeButton';
import MarketCommentsPanel from '@/components/market/MarketCommentsPanel';
import Tag from '@/components/ui/Tag';
import { IconButton } from '@/components/ui/FrostedButton';
import CommentInput from '@/components/ui/CommentInput';
import { formatPrice } from '@/utils/helpers';
import { getTagColor } from '@/utils/tagColors';
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'react-toastify';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';

type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
};

const MarketViewModal: React.FC<Props> = ({ open, item, onClose, onCommentCountChange }) => {
  // Hooks must be called in the same order every render
  const [commentCount, setCommentCount] = React.useState<number>(item?.commentsCount ?? 0);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [commentText, setCommentText] = React.useState('');
  const [postingComment, setPostingComment] = React.useState(false);
  const [commentPosted, setCommentPosted] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const currentUserId = useSelector((s: RootState) => s.user.profile?.id);

  function onEmojiClick(emojiData: EmojiClickData) {
    setCommentText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    // Cleanup function to ensure the class is removed when the component unmounts
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  if (!open || !item) return null;

  const priceRange =
    typeof item.minPrice === 'number' && typeof item.maxPrice === 'number'
      ? `${formatPrice(item.minPrice)} – ${formatPrice(item.maxPrice)}`
      : typeof item.minPrice === 'number'
        ? `From ${formatPrice(item.minPrice)}`
        : typeof item.maxPrice === 'number'
          ? `Up to ${formatPrice(item.maxPrice)}`
          : null;

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
      setCommentCount(prev => prev + 1);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setPostingComment(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
  <div className="relative m-4 grid h-[90vh] w-[95%] max-w-6xl grid-cols-12 gap-0 rounded-2xl bg-white/5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
        <div className={`col-span-12 ${leftColsSm} ${leftColsMd} rounded-l-2xl bg-black overflow-y-auto`}> 
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
  <div className={`col-span-12 flex flex-col p-4 ${rightColsSm} ${rightColsMd} overflow-y-auto modal-scrollbar relative bg-white/60 dark:bg-white/5 backdrop-blur-xl border-l border-white/20 dark:border-white/10 rounded-r-2xl` }>
          {/* Data Area */}
          <div className="pb-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-purple-500 text-white">
                {item.brandLogo ? (
                  <img src={item.brandLogo} alt={brandLabel} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                    {(brandLabel.charAt(0) || 'B').toUpperCase()}
                  </div>
                )}
              </div>
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
                {priceRange && (
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{priceRange}</span>
                )}
                <IconButton variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => { /* TODO: cart */ }} tooltip="Add to cart" />
              </div>
            </div>
          </div>

          {/* Comments Area */}
          <div className="min-h-0 flex-1 pt-3 mt-3 flex flex-col">
            <MarketCommentsPanel
              mediaId={item.id}
              collectionId={item.collectionId}
              contentOwnerId={item.brandId}
              currentUserId={currentUserId}
              onCountChange={(c) => {
                setCommentCount(c);
                onCommentCountChange?.(c);
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
  );
};

export default MarketViewModal;

