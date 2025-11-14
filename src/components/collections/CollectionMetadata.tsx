import React from 'react';
import { Heart, Share2, ShoppingCart, Trash2 } from 'lucide-react';
import TagChip from '@/components/ui/Tag';

interface CollectionMetadataProps {
  title: string;
  description?: string | null;
  tags?: string[];
  stats?: { likes?: number; comments?: number; items?: number; views?: number };
  price?: { min?: number; max?: number };
  availabilityInStore?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  isOwner?: boolean;
  isLiked?: boolean;
  onLike?: () => void;
  onShare?: () => void;
  onAddToCart?: () => void;
  onDelete?: () => void;
}

const formatCurrency = (n?: number) => {
  if (typeof n !== 'number' || isNaN(n)) return undefined;
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₦${Math.round(n).toLocaleString()}`;
  }
};

export const CollectionMetadata: React.FC<CollectionMetadataProps> = ({
  title,
  description,
  tags = [],
  stats,
  price,
  availabilityInStore,
  visibility,
  isOwner,
  isLiked = false,
  onLike,
  onShare,
  onAddToCart,
  onDelete,
}) => {
  const priceBand = (() => {
    const min = formatCurrency(price?.min);
    const max = formatCurrency(price?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();

  return (
    <div className="space-y-4">
      {/* Title & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-semibold leading-tight text-gray-900 dark:text-white">{title}</h2>
          {visibility && (
            <span
              className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                visibility === 'PUBLIC'
                  ? 'text-emerald-700 border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'text-amber-700 border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'
              }`}
            >
              {visibility === 'PUBLIC' ? 'Public' : 'Private'}
            </span>
          )}
        </div>
        {isOwner && onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            title="Delete collection"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line line-clamp-4">
          {description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 8).map((t) => (
            <TagChip key={t} label={`#${t}`} size="sm" />
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {typeof stats?.items === 'number' && (
          <div className="rounded-lg bg-white/80 dark:bg-white/5 px-3 py-2 border border-gray-200/60 dark:border-white/10">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Pieces</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{stats.items}</div>
          </div>
        )}
        {typeof stats?.views === 'number' && (
          <div className="rounded-lg bg-white/80 dark:bg-white/5 px-3 py-2 border border-gray-200/60 dark:border-white/10">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Views</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{stats.views}</div>
          </div>
        )}
        {typeof stats?.likes === 'number' && (
          <div className="rounded-lg bg-white/80 dark:bg-white/5 px-3 py-2 border border-gray-200/60 dark:border-white/10">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Likes</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{stats.likes}</div>
          </div>
        )}
        {typeof stats?.comments === 'number' && (
          <div className="rounded-lg bg-white/80 dark:bg-white/5 px-3 py-2 border border-gray-200/60 dark:border-white/10">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Comments</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{stats.comments}</div>
          </div>
        )}
      </div>

      {/* Price Band */}
      {(priceBand || availabilityInStore) && (
        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-3 py-2.5 border border-purple-200/60 dark:border-purple-700/40">
          {priceBand && (
            <div className="text-xs">
              <span className="text-gray-600 dark:text-gray-400">Price range:</span>{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{priceBand}</span>
            </div>
          )}
          {availabilityInStore && (
            <div className="text-xs mt-1 text-emerald-700 dark:text-emerald-300 font-medium">✓ Available in store</div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isOwner && (
        <div className="flex gap-2">
          <button
            onClick={onLike}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
              isLiked
                ? 'bg-pink-50 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-600/40 dark:text-pink-300'
                : 'bg-white/80 border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-xs font-medium">Like</span>
          </button>
          <button
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border bg-white/80 border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10 transition"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs font-medium">Share</span>
          </button>
        </div>
      )}
      {!isOwner && onAddToCart && (
        <button
          onClick={onAddToCart}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition shadow-lg shadow-purple-500/30"
        >
          <ShoppingCart className="w-4 h-4" />
          Add to Cart
        </button>
      )}
    </div>
  );
};

export default CollectionMetadata;
