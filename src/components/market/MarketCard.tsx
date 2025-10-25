import React, { useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import type { MarketItem } from '@/types/market';
import { formatPrice } from '@/utils/helpers';

interface MarketCardProps {
  item: MarketItem;
  onViewCollection?: (collectionId: string) => void;
  onViewBrand?: (brandId: string) => void;
  className?: string;
}

export const MarketCard: React.FC<MarketCardProps> = ({ item, onViewCollection, onViewBrand, className }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isVideo = Boolean(item.media.type?.toUpperCase().includes('VIDEO'));
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
      onClick={() => onViewCollection?.(item.collectionId)}
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
            {displayTags.map((tag) => (
              <div key={tag} className="rounded-full bg-primary/80 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                #{tag}
              </div>
            ))}
          </div>
        )}

        {/* Vertical Action Bar (Right Side - Instagram/TikTok Style) */}
        <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
          <button 
            className="flex flex-col items-center text-white drop-shadow-lg hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // Handle like action
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
              <Heart className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold mt-1 drop-shadow">{item.likesCount ?? 0}</span>
          </button>
          
          <button 
            className="flex flex-col items-center text-white drop-shadow-lg hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // Handle share action
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
              <Share2 className="h-5 w-5" />
            </div>
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
            className="flex items-center gap-2.5 mb-3 w-fit rounded-lg bg-gradient-to-r from-primary/60 to-purple-600/60 backdrop-blur-xl border border-white/30 px-3 py-2 shadow-lg hover:from-primary/70 hover:to-purple-600/70 transition-all"
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
          <h3 className="text-base font-bold mb-2 line-clamp-2 leading-tight drop-shadow-lg">
            {item.collectionTitle}
          </h3>

          {/* Comment Input Area (Bottom) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 relative">
              <MessageCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
              <input
                type="text"
                placeholder="Add a comment..."
                className="w-full rounded-lg bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder-white/60 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
                onClick={(e) => e.stopPropagation()}
                readOnly
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-white/80 drop-shadow">
              {item.commentsCount ?? 0}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default MarketCard;
