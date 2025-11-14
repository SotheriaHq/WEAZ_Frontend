import React from 'react';
import { Heart, Share2, ShoppingCart, Trash2, MessageCircle, Eye } from 'lucide-react';
import TagChip from '@/components/ui/Tag';

interface CollectionMetadataProps {
  title: string;
  description?: string | null;
  tags?: string[];
  stats?: { likes?: number; comments?: number; items?: number; views?: number };
  price?: { min?: number; max?: number; saleMin?: number | null; saleMax?: number | null; saleStartAt?: string | null; saleEndAt?: string | null };
  availabilityInStore?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  isOwner?: boolean;
  isLiked?: boolean;
  onLike?: () => void;
  onShare?: () => void;
  onAddToCart?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  ownerMenu?: React.ReactNode;
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
  onEdit,
  ownerMenu,
}) => {
  const hasSaleValues = (typeof price?.saleMin === 'number' && price?.saleMin !== price?.min) || (typeof price?.saleMax === 'number' && price?.saleMax !== price?.max);
  const isSaleActive = (() => {
    const start = price?.saleStartAt ? Date.parse(price.saleStartAt) : null;
    const end = price?.saleEndAt ? Date.parse(price.saleEndAt) : null;
    const now = Date.now();
    if (!hasSaleValues) return false;
    if (start && isNaN(start)) return false;
    if (end && isNaN(end)) return false;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  })();
  const baseBand = (() => {
    const min = formatCurrency(price?.min);
    const max = formatCurrency(price?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();
  const saleBand = (() => {
    const min = formatCurrency(price?.saleMin ?? undefined);
    const max = formatCurrency(price?.saleMax ?? undefined);
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();

  return (
    <div className="space-y-3">
      {/* Title & Actions Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
              {title}
            </h2>
            {visibility && (
              <span
                className={`inline-block text-[9px] px-1.5 py-0.5 rounded-md border font-medium uppercase tracking-wider ${
                  visibility === 'PUBLIC'
                    ? 'text-emerald-700 border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'text-amber-700 border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'
                }`}
              >
                {visibility}
              </span>
            )}
          </div>
          
          {/* Engagement Stats - Top Position with Icons */}
          <div className="flex items-center gap-3 text-sm">
            {typeof stats?.likes === 'number' && (
              <button
                onClick={onLike}
                className={`flex items-center gap-1 transition ${
                  isLiked
                    ? 'text-pink-600 dark:text-pink-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span className="font-semibold">{stats.likes}</span>
              </button>
            )}
            {typeof stats?.comments === 'number' && (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <MessageCircle className="w-4 h-4" />
                <span className="font-semibold">{stats.comments}</span>
              </div>
            )}
            {isOwner && typeof stats?.views === 'number' && (
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-500 text-xs">
                <Eye className="w-3.5 h-3.5" />
                <span>{stats.views}</span>
              </div>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-1">
            {ownerMenu ? ownerMenu : (
              onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                  title="Edit collection"
                >
                  <span role="img" aria-label="edit" className="text-sm leading-none">✏️</span>
                </button>
              )
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                title="Delete collection"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
          {description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((t) => (
            <TagChip key={t} label={`#${t}`} size="sm" />
          ))}
        </div>
      )}

      {/* Price Band - with sale support */}
      {(baseBand || availabilityInStore || saleBand) && (
        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-3 py-2 border border-purple-200/60 dark:border-purple-700/40">
              {(isSaleActive && saleBand && baseBand) ? (
                <div className="space-y-1">
                  <div className="text-[11px] px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200/60 dark:border-red-700/40 flex items-center gap-1 justify-between">
                    <span className="text-red-700 dark:text-red-300 font-medium line-through" aria-label="Original price">{baseBand}</span>
                  </div>
                  <div className="text-[12px] px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/40 flex items-center gap-1 justify-between">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300" aria-label="Sale price">{saleBand}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Sale</span>
                  </div>
                </div>
          ) : (
            baseBand && (
              <div className="text-xs">
                <span className="text-gray-600 dark:text-gray-400">Price:</span>{' '}
                <span className="font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{baseBand}</span>
              </div>
            )
          )}
          {availabilityInStore && (
            <div className="text-[10px] mt-0.5 text-emerald-700 dark:text-emerald-300 font-medium">✓ In-store</div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isOwner && (
        <>
          <div className="flex gap-2">
            <button
              onClick={onShare}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border bg-white/80 border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10 transition text-xs font-medium"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
          {onAddToCart && (
            <button
              onClick={onAddToCart}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:from-purple-700 hover:to-pink-700 transition shadow-lg shadow-purple-500/30"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default CollectionMetadata;
