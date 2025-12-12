import React, { useEffect, useState } from 'react';
import { MessageCircle, Share2, MoreVertical, Store, AlertTriangle, Loader2 } from 'lucide-react';
import LikeButton from '@/components/ui/LikeButton';
import type { CollectionDto } from '../../types/profile';
import { formatPrice } from '@/utils/helpers';
import { brandApi } from '@/api/BrandApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import ManageAccessModal from './ManageAccessModal';

interface CollectionCardProps {
  collection: CollectionDto;
  onClick?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
  isDraft?: boolean;
  onRetryPublish?: (id: string) => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ 
  collection, 
  onClick,
  onEdit, 
  onDelete,
  showActions = true,
  isDraft = false,
  onRetryPublish,
}) => {
  const {
    title,
    coverImage,
    coverFileId,
    likesCount = 0,
    commentsCount = 0,
    itemCount = 0,
    postsCount = 0,
    minPrice = 0,
    maxPrice = 0,
    saleMinPrice,
    saleMaxPrice,
    saleStartAt,
    saleEndAt,
    brandName,
    username,
    brandLogo,
    isAvailableInStore = false,
  } = collection;

  const clientStatus = collection.clientStatus;
  const isPublishing = clientStatus === 'publishing';
  const publishFailed = clientStatus === 'publish-failed';
  const statusMessage = collection.clientStatusMessage || (isPublishing ? 'Publishing...' : publishFailed ? 'Publish failed' : undefined);

  const displayItemCount = itemCount || postsCount;
  const [resolvedCover, setResolvedCover] = useState<string | undefined>(coverImage || undefined);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    const maybeResolve = async () => {
      // Optimization: If coverImage is already a signed URL (has query params), use it directly.
      // This avoids an extra network request on initial load and fixes "barely loaded" issues.
      if (coverImage && (coverImage.includes('?') || !coverImage.includes('s3'))) {
         setResolvedCover(coverImage);
         return;
      }

      if (coverFileId) {
        const url = await brandApi.getSignedFileUrl(coverFileId);
        if (mounted) setResolvedCover(url ?? undefined);
        return;
      }
      if (coverImage && coverImage.length > 0) {
        setResolvedCover(coverImage);
        return;
      }
    };
    void maybeResolve();
    return () => {
      mounted = false;
    };
  }, [coverImage, coverFileId]);

  // Reset loaded flag when image source changes
  useEffect(() => {
    setImgLoaded(false);
  }, [resolvedCover]);
  const [accessOpen, setAccessOpen] = useState(false);

  // Compute compact price bands (align with MarketCard)
  const baseBand = (() => {
    const hasMin = typeof minPrice === 'number' && Number.isFinite(minPrice) && minPrice > 0;
    const hasMax = typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice > 0;
    const min = hasMin ? formatPrice(minPrice) : undefined;
    const max = hasMax ? formatPrice(maxPrice) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const now = Date.now();
  const saleWindowOk = (() => {
    // Allow 5 minute clock skew buffer for start time
    const startOk = !saleStartAt || (new Date(saleStartAt).getTime() <= now + 5 * 60 * 1000);
    const endOk = !saleEndAt || (new Date(saleEndAt).getTime() >= now);
    return startOk && endOk;
  })();

  const hasSaleMin = typeof saleMinPrice === 'number' && Number.isFinite(saleMinPrice);
  const hasSaleMax = typeof saleMaxPrice === 'number' && Number.isFinite(saleMaxPrice);
  const saleBand = saleWindowOk ? (() => {
    const min = hasSaleMin ? formatPrice(saleMinPrice as number) : undefined;
    const max = hasSaleMax ? formatPrice(saleMaxPrice as number) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })() : null;

  const showStacked = Boolean(saleBand && baseBand);
  const singleBand = saleBand ?? baseBand;

  return (
    <>
    <div 
      className="relative group w-full glass-panel overflow-hidden rounded-lg cursor-pointer shadow-md transition-transform duration-200 hover:scale-[1.02]"
      onClick={isPublishing ? undefined : onClick}
    >
      {/* Background Media */}
      <div className="relative w-full overflow-hidden">
        {(isPublishing || publishFailed) && (
          <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white px-4 text-center">
            {isPublishing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <div className="text-sm font-medium">{statusMessage}</div>
                <div className="text-xs text-white/70">You can keep browsing; we will finish this in the background.</div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-300" />
                <div className="text-sm font-semibold">{statusMessage || 'Publish delayed'}</div>
                <div className="text-xs text-white/70">Tap retry to check again.</div>
                {onRetryPublish && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRetryPublish(collection.id); }}
                    className="px-3 py-1 rounded-lg bg-white/15 border border-white/25 text-xs font-semibold hover:bg-white/20"
                  >
                    Retry status
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {resolvedCover ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-white/10 dark:bg-white/5" />
            )}
            
            {/* Check if video based on extension */}
            {(() => {
              const isVideo = resolvedCover.match(/\.(mp4|webm|mov|m4v)($|\?)/i);
              if (isVideo) {
                return (
                  <video
                    src={resolvedCover}
                    className={`block w-full object-cover transition-opacity duration-500 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                    style={{ minHeight: '320px' }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onLoadedData={() => setImgLoaded(true)}
                  />
                );
              }
              return (
                <img 
                  src={resolvedCover} 
                  alt={title} 
                  className={`block w-full object-cover transition-opacity duration-500 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  style={{ minHeight: '320px' }}
                  onLoad={() => setImgLoaded(true)}
                />
              );
            })()}
          </>
          ) : (
            <div className="relative flex min-h-[320px] w-full items-center justify-center glass-panel">
              <span className="text-white text-3xl font-bold opacity-70">
                {title.charAt(0)}
              </span>
              {/* Resolving signed URL skeleton shimmer */}
              {coverFileId && (
                <div className="absolute inset-0 animate-pulse bg-white/10 dark:bg-white/5" />
              )}
            </div>
          )}
        
        {/* Always-visible gradient overlay for text readability - lighter for more image visibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        
        {/* Available in Store badge (top left) */}
        {isAvailableInStore && (
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              <Store className="w-3.5 h-3.5" />
              <span>In Store</span>
            </div>
          </div>
        )}
        
        {/* Three-dot menu for owners (top right) */}
        {showActions && (onEdit || onDelete) && (
          <div className="absolute top-3 right-3 z-50" onClick={(e) => e.stopPropagation()}>
            <Dropdown>
              <DropdownTrigger className="btn-tight-xs">
                <MoreVertical className="w-4 h-4" />
              </DropdownTrigger>
              <DropdownMenu className="glass-menu-soft">
                {onEdit && (
                  <DropdownItem onClick={() => onEdit(collection.id)}>Edit</DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem onClick={() => onDelete(collection.id)}>Delete</DropdownItem>
                )}
                <DropdownItem onClick={() => setAccessOpen(true)}>Manage Access</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        )}

        {/* Vertical Action Bar (like in Reels) - Right side */}
        {!isDraft && (
        <div className="absolute bottom-28 right-2 z-10 flex flex-col items-center gap-3">
          <LikeButton contentType="COLLECTION" contentId={collection.id} initialCount={likesCount} ownerId={collection.ownerId} />
          <button className="flex flex-col items-center text-white hover:scale-110 transition-transform" onClick={(e) => e.stopPropagation()}>
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{commentsCount}</span>
          </button>
          <button className="flex flex-col items-center text-white hover:scale-110 transition-transform" onClick={(e) => e.stopPropagation()}>
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        )}

        {/* Bottom Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white z-10">
          {/* Brand Info with Avatar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 flex-shrink-0 ring-1 ring-white/30 rounded-sm overflow-hidden">
              <ImageWithFallback
                src={brandLogo}
                fileId={collection.brandLogoFileId}
                alt={brandName || username || 'Brand'}
                containerClassName="w-full h-full"
                rounded="sm"
                fallbackName={brandName || username || 'B'}
              />
            </div>
            <div className="flex-1 min-w-0">
              {brandName && (
                <p className="text-white font-bold text-xs truncate leading-tight">{brandName}</p>
              )}
              {username && (
                <p className="text-white/70 text-[10px] truncate leading-tight">@{username}</p>
              )}
            </div>
          </div>

          {/* Collection Title */}
          <h3 className="text-base font-bold mb-1 line-clamp-2 leading-tight">{title}</h3>
          
          {/* Collection Stats */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/90 mb-2">
            <span>{displayItemCount} pieces</span>
          </div>
          {/* Sale / Price Container */}
          {(baseBand || saleBand) && (
            <div className="mb-2 rounded-md bg-white/15 backdrop-blur-sm border border-white/25 p-2 flex flex-col gap-1">
              {showStacked ? (
                <>
                  {baseBand && (
                    <div className="text-[10px] text-white/70 line-through" aria-label="Original price">{baseBand}</div>
                  )}
                  <div className="flex items-center justify-between">
                    {saleBand && (
                      <div className="text-xs font-bold text-emerald-300" aria-label="Sale price">{saleBand}</div>
                    )}
                    {saleBand && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/40 border border-emerald-400/60 text-white" aria-label="Sale badge">Sale</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs font-semibold {saleBand ? 'text-emerald-300' : ''}" aria-label="Price band">{singleBand}</div>
              )}
            </div>
          )}

          {/* Footer row with comment input placeholder (left) and compact View pill (right) */}
          <div className="flex items-center gap-2">
            {/* Comment input placeholder area */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Add a comment..."
                className="w-full rounded-md bg-white/10 text-white placeholder-white/60 border border-white/20 backdrop-blur-sm px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40"
                onClick={(e) => e.stopPropagation()}
                readOnly
              />
            </div>
            <button
              className="shrink-0 px-3 py-1 rounded-md bg-white/10 border border-white/20 text-white text-[11px] font-medium backdrop-blur-sm hover:bg-white/15 transition"
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            >
              {isDraft ? 'Continue Creation' : 'View'}
            </button>
          </div>
        </div>
      </div>
    </div>
    <ManageAccessModal open={accessOpen} collectionId={collection.id} onClose={() => setAccessOpen(false)} />
    </>
  );
};

export default CollectionCard;


