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
  onCancelSale?: () => void;
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
  onCancelSale,
}) => {
  // Track received price data

  const baseBand = (() => {
    const min = formatCurrency(price?.min);
    const max = formatCurrency(price?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();
  const hasSaleMin = typeof price?.saleMin === 'number' && Number.isFinite(price?.saleMin as number);
  const hasSaleMax = typeof price?.saleMax === 'number' && Number.isFinite(price?.saleMax as number);
  if (!hasSaleMin && price?.saleMin != null) {
    console.warn('⚠️ [CollectionMetadata] saleMin is not numeric', { value: price?.saleMin, type: typeof price?.saleMin });
  }
  if (!hasSaleMax && price?.saleMax != null) {
    console.warn('⚠️ [CollectionMetadata] saleMax is not numeric', { value: price?.saleMax, type: typeof price?.saleMax });
  }
  const saleBandRaw = (() => {
    const min = hasSaleMin ? formatCurrency(price?.saleMin as number) : undefined;
    const max = hasSaleMax ? formatCurrency(price?.saleMax as number) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();

  const now = Date.now();
  const windowActive = (() => {
    const startOk = !price?.saleStartAt || new Date(price?.saleStartAt).getTime() <= now;
    const endOk = !price?.saleEndAt || new Date(price?.saleEndAt).getTime() >= now;
    return startOk && endOk;
  })();
  const saleBand = windowActive ? saleBandRaw : undefined;

  const showStacked = Boolean(saleBand && baseBand);
  const singleBand = saleBand ?? baseBand;


  // 🔧 FIX #7: Enhanced countdown with color coding and urgency levels
  const [timeLeftLabel, setTimeLeftLabel] = React.useState<string | null>(null);
  const [urgencyLevel, setUrgencyLevel] = React.useState<'low' | 'medium' | 'high' | 'critical'>('low');
  
  React.useEffect(() => {
    if (!saleBand || !price?.saleEndAt) { setTimeLeftLabel(null); return; }
    const end = new Date(price.saleEndAt).getTime();
    const calc = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeftLabel('Ended'); setUrgencyLevel('critical'); return; }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h < 1) { setUrgencyLevel('critical'); setTimeLeftLabel(`${m}m ${sec}s`); }
      else if (h < 6) { setUrgencyLevel('high'); setTimeLeftLabel(`${h}h ${m}m`); }
      else if (d < 1) { setUrgencyLevel('medium'); setTimeLeftLabel(`${h}h ${m}m`); }
      else { setUrgencyLevel('low'); setTimeLeftLabel(`${d}d ${h}h`); }
    };
    calc();
    const intervalMs = (() => {
      const remaining = end - Date.now();
      if (remaining < 10 * 60 * 1000) return 1000; // <10m update per second
      if (remaining < 60 * 60 * 1000) return 5000; // <1h fast updates
      if (remaining < 6 * 60 * 60 * 1000) return 15000; // <6h moderate
      return 60000; // otherwise minute granularity
    })();
    const id = window.setInterval(calc, intervalMs);
    return () => window.clearInterval(id);
  }, [saleBand, price?.saleEndAt]);

  return (
    <div className="space-y-3">
      {/* Title & Actions Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
            {/* 🔧 FIX #6: Responsive title sizing */}
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
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
          {/* 🔧 FIX #6: Responsive gap and text sizing */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
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
      {/* 🔧 FIX #6: Responsive description text */}
      {description && (
        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
          {description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((t, idx) => {
            const colors: Array<'purple' | 'blue' | 'green' | 'orange' | 'red'> = ['purple', 'blue', 'green', 'orange', 'red'];
            const color = colors[idx % colors.length];
            return <TagChip key={t} label={`#${t}`} size="sm" color={color} />;
          })}
        </div>
      )}

      {/* Price Band - with sale support and frosted glass styling */}
      {/* 🔧 FIX #6: Responsive padding */}
      {(baseBand || availabilityInStore || saleBand) && (
        <div className="rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-white/20 bg-white/60 dark:bg-white/10 backdrop-blur-md shadow-sm">
          {showStacked ? (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[11px] text-gray-600 dark:text-gray-400 line-through" aria-label="Original price">{baseBand}</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300" aria-label="Sale price">{saleBand}</span>
              <span
                className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold backdrop-blur-md shadow-sm border ${
                  urgencyLevel === 'critical' ? 'bg-red-600/30 border-red-400/40 text-red-50' :
                  urgencyLevel === 'high' ? 'bg-orange-500/30 border-orange-400/40 text-orange-50' :
                  urgencyLevel === 'medium' ? 'bg-yellow-500/30 border-yellow-400/40 text-yellow-50' :
                  'bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                }`}
                aria-label="Sale countdown"
              >
                {timeLeftLabel ? `${timeLeftLabel} left` : 'Sale'}
              </span>
            </div>
          ) : (
            singleBand && (
              <div className="text-xs flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">Price:</span>
                <span className="font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{singleBand}</span>
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

      {/* Owner-only actions */}
      {isOwner && saleBandRaw && (
        <div className="flex gap-2">
          {onCancelSale && (
            <button
              onClick={onCancelSale}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-300/40 bg-white/50 dark:bg-white/10 text-red-700 dark:text-red-300 hover:bg-white/70 dark:hover:bg-white/15 transition text-xs font-semibold backdrop-blur-md shadow-sm"
            >
              Cancel Sale
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectionMetadata;
