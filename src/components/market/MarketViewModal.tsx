import React from 'react';
import { X, Share2, MessageCircle, Plus } from 'lucide-react';
import type { MarketItem } from '@/types/market';
import MediaViewer from '@/components/media/MediaViewer';
import LikeButton from '@/components/ui/LikeButton';
import MarketCommentsPanel from '@/components/market/MarketCommentsPanel';
import Tag from '@/components/ui/Tag';
import { IconButton } from '@/components/ui/FrostedButton';
import { formatPrice } from '@/utils/helpers';
import { getTagColor } from '@/utils/tagColors';

type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
};

const MarketViewModal: React.FC<Props> = ({ open, item, onClose }) => {
  // Hooks must be called in the same order every render
  const [commentCount, setCommentCount] = React.useState<number>(item?.commentsCount ?? 0);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative m-4 grid h-[90vh] w-full max-w-[850px] grid-cols-12 gap-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-black/70 p-2 text-white hover:bg-black/80"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Left: Media */}
        <div className={`col-span-12 bg-black ${leftColsSm} ${leftColsMd}`}>
          <div className="flex h-full items-center justify-center overflow-hidden">
            {/* Ensure the media is fully visible without cropping - use cover for tall images, contain for others */}
            <MediaViewer
              media={item.media}
              rounded={false}
              objectFit={item.media.aspectRatio && item.media.aspectRatio > 1.5 ? "cover" : "contain"}
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Right: Data Area + Comments */}
        <div className={`col-span-12 flex h-full flex-col bg-gradient-to-b from-purple-50/95 via-purple-100/90 to-purple-200/85 dark:from-purple-950/90 dark:via-purple-900/70 dark:to-purple-800/60 backdrop-blur-sm p-4 ${rightColsSm} ${rightColsMd}`}>
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
              <LikeButton contentType="COLLECTION_MEDIA" contentId={item.id} initialCount={item.likesCount ?? 0} />
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
          <div className="min-h-0 flex-1">
            <MarketCommentsPanel mediaId={item.id} collectionId={item.collectionId} onCountChange={(c) => setCommentCount(c)} showComposer={true} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default MarketViewModal;

