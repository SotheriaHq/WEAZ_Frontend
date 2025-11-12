import React, { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { CommentsApi } from '@/api/CommentsApi';
import { toast } from 'react-toastify';
import LikeButton from '@/components/ui/LikeButton';
import CommentInput from '@/components/ui/CommentInput';
import Tag from '@/components/ui/Tag';
import type { MarketItem } from '@/types/market';
import { formatPrice } from '@/utils/helpers';
import { getTagColor } from '@/utils/tagColors';
import { selectCommentCount } from '@/features/engagementSlice';
import { useRealtime } from '@/realtime/RealtimeProvider';

interface MarketCardProps {
  item: MarketItem;
  onOpenView?: (item: MarketItem) => void;
  onViewCollection?: (collectionId: string) => void;
  onViewBrand?: (brandId: string) => void;
  className?: string;
}

export const MarketCard: React.FC<MarketCardProps> = ({ item, onOpenView, onViewCollection, onViewBrand, className }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isVideo = Boolean(item.media.type?.toUpperCase().includes('VIDEO'));
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const realtime = useRealtime();
  
  // Join WebSocket room for real-time comment/like updates
  useEffect(() => {
    realtime.joinCollectionMedia(item.id);
  }, [item.id, realtime]);
  
  // Use Redux selector for real-time comment count synchronization
  const commentCount = useSelector((s: RootState) => 
    selectCommentCount(s, 'COLLECTION_MEDIA', item.id) ?? item.commentsCount ?? 0
  );
  const priceRange =
    typeof item.minPrice === 'number' && typeof item.maxPrice === 'number'
      ? `${formatPrice(item.minPrice)} – ${formatPrice(item.maxPrice)}`
      : typeof item.minPrice === 'number'
        ? `From ${formatPrice(item.minPrice)}`
        : typeof item.maxPrice === 'number'
          ? `Up to ${formatPrice(item.maxPrice)}`
          : null;

  const displayTags = item.tags.slice(0, 2);

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(129,140,248,0.3)] cursor-pointer ${className ?? ''}`}
      onClick={() => {
        if (onOpenView) {
          onOpenView(item);
        } else {
          onViewCollection?.(item.collectionId);
        }
      }}
    >
      {/* Full Image Background */}
      <div className="relative w-full overflow-hidden">
        {isVideo ? (
          <video
            preload="metadata"
            className="block w-full"
            poster={item.media.previewUrl ?? undefined}
            style={{ minHeight: '280px' }}
          >
            <source src={item.media.url ?? undefined} />
          </video>
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-purple-100/40 via-white/40 to-white/20 dark:from-purple-900/20 dark:via-purple-900/10 dark:to-gray-900/40" />
            )}
            <img
              src={item.media.url ?? undefined}
              alt={item.collectionTitle}
              className={`block w-full transition-opacity duration-500 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ minHeight: '280px' }}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </>
        )}
        
        {/* Gradient Overlay for Text Readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Price Badge (Top Right) */}
        {priceRange && (
          <div className="absolute top-3 right-3 z-20">
            <div className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              {priceRange}
            </div>
          </div>
        )}

        {/* Tags (Top Left) */}
        {displayTags.length > 0 && (
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
            {displayTags.map((tag) => {
              const color = getTagColor(tag);
              return (
                <Tag key={tag} label={`#${tag}`} size="xs" color={color} />
              );
            })}
          </div>
        )}

        {/* Vertical Action Bar (Right Side - Instagram/TikTok Style) */}
        <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
          <LikeButton
            contentType="COLLECTION_MEDIA"
            contentId={item.id}
            initialCount={item.likesCount ?? 0}
            initialLiked={item.isLiked}
            ownerId={item.brandId}
          />
          
          <button 
            className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // Handle share action
            }}
          >
            <Share2 className="h-5 w-5" />
            <span className="text-xs font-bold mt-1 drop-shadow">{item.patchesCount ?? 0}</span>
          </button>
        </div>

        {/* Bottom Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
          {/* Brand Info with Glassmorphism */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewBrand?.(item.brandId);
            }}
            className="flex items-center gap-2 mb-2 w-fit rounded-lg px-3 py-2 transition-all"
          >
            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-gradient-to-br from-primary to-purple-500 shadow-md">
              {item.brandLogo ? (
                <img
                  src={item.brandLogo}
                  alt={item.brandName ?? item.username ?? 'Brand'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xs font-bold text-white">
                  {(item.brandName ?? item.username ?? 'B').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-bold text-sm truncate leading-tight text-white drop-shadow">
                {item.brandName ?? item.username ?? 'Brand'}
              </p>
              {item.username && item.brandName !== item.username && (
                <p className="text-xs truncate leading-tight text-white/80">
                  @{item.username}
                </p>
              )}
            </div>
          </button>

          {/* Collection Title */}
          <h3 className="text-base font-bold mb-1 line-clamp-2 leading-tight drop-shadow-lg">
            {item.collectionTitle}
          </h3>

          {/* Comment Input Area (Bottom) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <CommentInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={async () => {
                  if (!isAuth) { toast.info('Please sign in to comment.'); return; }
                  const content = commentText.trim();
                  if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
                  setCommentBusy(true);
                  try {
                    await CommentsApi.create('COLLECTION_MEDIA', item.id, content);
                    setCommentText('');
                    // Comment count will be updated via WebSocket real-time event (comment.created)
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message ?? 'Failed to post comment');
                  } finally { setCommentBusy(false); }
                }}
                disabled={commentBusy}
                busy={commentBusy}
                className="w-full"
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-white/80 drop-shadow">{commentCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default MarketCard;
