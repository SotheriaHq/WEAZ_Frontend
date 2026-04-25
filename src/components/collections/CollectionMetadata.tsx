import React from 'react';
import { Link2, ShoppingCart, Trash2, MessageCircle, Eye, Heart } from 'lucide-react';
import TagChip from '@/components/ui/Tag';

interface CollectionMetadataProps {
  title: string;
  description?: string | null;
  tags?: string[];
  stats?: { threads?: number; comments?: number; items?: number; views?: number };
  price?: { min?: number; max?: number; saleMin?: number | null; saleMax?: number | null; saleStartAt?: string | null; saleEndAt?: string | null };
  availabilityInStore?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  isOwner?: boolean;
  isThreaded?: boolean;
  onThread?: () => void;
  onShare?: () => void;
  onOpenQr?: () => void;
  onAddToCart?: () => void;
  onAddToWishlist?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  ownerMenu?: React.ReactNode;
  onCancelSale?: () => void;
  onSetupSale?: () => void;
  isWishlisted?: boolean;
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
  isThreaded = false,
  onThread,
  onShare,
  onOpenQr,
  onAddToCart,
  onAddToWishlist,
  onDelete,
  onEdit,
  ownerMenu,
  onCancelSale,
  isWishlisted = false,
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
    // Allow 5 minute clock skew buffer for start time
    const startOk = !price?.saleStartAt || new Date(price?.saleStartAt).getTime() <= now + 5 * 60 * 1000;
    const endOk = !price?.saleEndAt || new Date(price?.saleEndAt).getTime() >= now;
    return startOk && endOk;
  })();
  const saleBand = windowActive ? saleBandRaw : undefined;

  const hasPriceData = Boolean(baseBand || saleBand);


  // 🔧 FIX #7: Enhanced countdown with color coding and urgency levels
  const [timeLeftLabel, setTimeLeftLabel] = React.useState<string | null>(null);
  const [urgencyLevel, setUrgencyLevel] = React.useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [progressPercent, setProgressPercent] = React.useState(100);
  
  React.useEffect(() => {
    if (!saleBand || !price?.saleEndAt) { 
      setTimeLeftLabel(null); 
      return; 
    }
    
    const end = new Date(price.saleEndAt).getTime();
    // Use start time if available, otherwise assume sale started 24h ago for progress bar visual fallback
    // or just use current time if start is in future (which shouldn't happen due to windowActive check)
    const start = price.saleStartAt ? new Date(price.saleStartAt).getTime() : end - (24 * 60 * 60 * 1000);
    const totalDuration = Math.max(1, end - start);

    const calc = () => {
      const now = Date.now();
      const diff = end - now;
      
      // Calculate progress percentage (0% at start, 100% at end - or inverted for "remaining")
      // Let's do "remaining" bar: 100% full at start, 0% at end.
      const elapsed = now - start;
      const remainingPct = Math.max(0, Math.min(100, 100 - (elapsed / totalDuration) * 100));
      setProgressPercent(remainingPct);

      if (diff <= 0) { 
        setTimeLeftLabel('Ended'); 
        setUrgencyLevel('critical'); 
        // Trigger sale cancellation if expired
        if (onCancelSale) onCancelSale();
        return; 
      }
      
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      
      if (h < 1) { 
        setUrgencyLevel('critical'); 
        setTimeLeftLabel(`${m}m ${sec}s`); 
      } else if (h < 6) { 
        setUrgencyLevel('high'); 
        setTimeLeftLabel(`${h}h ${m}m`); 
      } else if (d < 1) { 
        setUrgencyLevel('medium'); 
        setTimeLeftLabel(`${h}h ${m}m`); 
      } else { 
        setUrgencyLevel('low'); 
        setTimeLeftLabel(`${d}d ${h}h`); 
      }
    };
    
    calc();
    // Update every second to ensure smooth progress bar and seconds countdown
    const id = window.setInterval(calc, 1000);
    return () => window.clearInterval(id);
  }, [saleBand, price?.saleEndAt, price?.saleStartAt, onCancelSale]);

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
          <div className="flex items-center gap-3 text-xs sm:text-sm flex-wrap">
            {typeof stats?.threads === 'number' && (
              <button
                onClick={onThread}
                className={`flex items-center gap-1 transition ${
                  isThreaded
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span className="font-semibold">{stats.threads}</span>
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

      {/* Price Band - Original Price */}
      {(hasPriceData || availabilityInStore) && (
        <div className="rounded-lg px-3 py-2 border border-gray-200 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm flex flex-col gap-1">
          {saleBand ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 line-through decoration-red-500/50 decoration-2" aria-label="Original price">
              {baseBand}
            </div>
          ) : (
            <div className="text-xs flex items-center gap-1">
              <span className="text-gray-600 dark:text-gray-400">Price:</span>
              <span className="font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{baseBand}</span>
            </div>
          )}
          {availabilityInStore && (
            <div className="text-[10px] mt-0.5 text-emerald-700 dark:text-emerald-300 font-medium">✓ In-store</div>
          )}
        </div>
      )}

      {/* Sale Container - Discount Price & Countdown */}
      {saleBand && (
        <div className="rounded-lg px-3 py-2 border border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-900/10 backdrop-blur-md shadow-sm flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400" aria-label="Sale price">{saleBand}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                Sale
              </span>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden`}>
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  urgencyLevel === 'critical' ? 'bg-red-500' :
                  urgencyLevel === 'high' ? 'bg-orange-500' :
                  urgencyLevel === 'medium' ? 'bg-yellow-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-bold tabular-nums ${
                urgencyLevel === 'critical' ? 'text-red-600 dark:text-red-400' :
                urgencyLevel === 'high' ? 'text-orange-600 dark:text-orange-400' :
                urgencyLevel === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {timeLeftLabel ? `${timeLeftLabel} left` : 'Ending soon'}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={`grid gap-2 ${onOpenQr ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border bg-white/80 border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10 transition text-xs font-medium"
        >
          <span aria-hidden="true">🔗</span>
          Share
        </button>
        {onOpenQr ? (
          <button
            onClick={onOpenQr}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border bg-white/80 border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10 transition text-xs font-medium"
          >
            <span aria-hidden="true">🪪</span>
            QR Code
          </button>
        ) : null}
      </div>

      {!isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onAddToCart && (
            <button
              onClick={onAddToCart}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition shadow-lg shadow-purple-500/30"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
          )}
          {onAddToWishlist && (
            <button
              onClick={onAddToWishlist}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition ${
                isWishlisted
                  ? 'border-purple-500 text-purple-600 dark:text-purple-300 bg-purple-500/10'
                  : 'border-purple-500 text-purple-500 dark:text-purple-300 hover:bg-purple-500/10'
              }`}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
              {isWishlisted ? 'In Wishlist' : 'Wishlist'}
            </button>
          )}
        </div>
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
