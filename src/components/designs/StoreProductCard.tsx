import React, { useState, useCallback } from 'react';
import { ShoppingBag, Eye, ImageOff, AlertTriangle, Package } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { toast } from 'sonner';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import MediaRenderer from '@/components/media/MediaRenderer';
import type { SizingMode } from '@/types/sizing';

export interface StoreProduct {
  id: string;
  collectionId: string;
  brandId: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  isOnSale: boolean;
  discountPercent?: number | null;
  thumbnail?: string;
  images: string[];
  media?: Array<{ id: string; url: string; type: string; isPrimary?: boolean }>;
  mediaIds?: string[];
  sizes: string[];
  sizingMode?: SizingMode;
  customMeasurementKeys?: string[];
  customAvailable?: boolean;
  sizeAvailability: { size: string; inStock: boolean; quantity: number }[];
  colors: string[];
  variants?: Array<{
    id: string;
    size: string | null;
    color: string | null;
    stock: number;
    price?: number | null;
    sku?: string | null;
    colorHex?: string | null;
  }>;
  totalStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
  publishAt?: string | null;
  threadsCount: number;
  viewsCount: number;
  brand: {
    id: string;
    name: string;
    logo?: string;
    currency: string;
  };
}

interface StoreProductCardProps {
  product: StoreProduct;
  onViewProduct?: (product: StoreProduct) => void;
  isWishlisted?: boolean;
  className?: string;
  /** Owner mode shows edit/manage controls instead of purchase controls */
  isOwnerView?: boolean;
  onEdit?: (product: StoreProduct) => void;
}

export const StoreProductCard: React.FC<StoreProductCardProps> = ({
  product,
  onViewProduct,
  className = '',
  isOwnerView = false,
  onEdit,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const isOwnProduct = Boolean(currentUser?.id && product.brandId === currentUser.id);
  const redHeartEmoji = String.fromCodePoint(0x2764, 0xfe0f);
  const whiteHeartEmoji = String.fromCodePoint(0x1f90d);
  const isCustomAvailable = product.customAvailable === true;
  const ownerStatus = (() => {
    if (!isOwnerView) return null;
    if (product.deletedAt) {
      return { emoji: '🗑️', label: 'Deleted', className: 'bg-rose-500/90 text-white' };
    }
    if (product.archivedAt) {
      return { emoji: '📦', label: 'Archived', className: 'bg-gray-500/90 text-white' };
    }
    const publishAtTs = product.publishAt ? new Date(product.publishAt).getTime() : null;
    const isScheduled = typeof publishAtTs === 'number' && Number.isFinite(publishAtTs) && publishAtTs > Date.now();
    if (isScheduled) {
      return { emoji: '⏰', label: 'Scheduled', className: 'bg-sky-500/90 text-white' };
    }
    if (product.isActive === false) {
      return { emoji: '📝', label: 'Draft', className: 'bg-amber-500/90 text-white' };
    }
    return { emoji: '✅', label: 'Published', className: 'bg-emerald-500/90 text-white' };
  })();

  // Derive wishlist state entirely from Redux for real-time sync
  const isProductWishlisted = wishlistedIds.has(product.id);

  const formatPrice = useCallback((price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }, []);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOwnProduct) {
      toast.info('Brands cannot add their own product to wishlist.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to use wishlist');
      return;
    }

    setWishlistLoading(true);
    try {
      if (isProductWishlisted) {
        await dispatch(removeFromWishlist(product.id)).unwrap();
        toast.success('Removed from wishlist');
      } else {
        await dispatch(addToWishlist(product.id)).unwrap();
        toast.success('Added to wishlist');
      }
    } catch (error: any) {
      toast.error(error || 'Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleQuickAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOwnProduct) {
      toast.info('Brands cannot add their own product to cart.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to add to cart');
      return;
    }

    if (product.isOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    // Products with selectable options must go through detail selection first.
    if (product.sizes.length > 0 || product.colors.length > 0) {
      onViewProduct?.(product);
      return;
    }

    setCartLoading(true);
    try {
      await dispatch(addToCart({ productId: product.id, quantity: 1 })).unwrap();
      dispatch(openCartDrawer());
      toast.success('Added to cart');
    } catch (error: any) {
      toast.error(error || 'Failed to add to cart');
    } finally {
      setCartLoading(false);
    }
  };

  const handleCardClick = () => {
    if (isOwnerView && onEdit) {
      onEdit(product);
    } else {
      onViewProduct?.(product);
    }
  };

  // Determine which image to show (hover shows second image if available)
  const primaryMedia = product.media?.find((m) => m.isPrimary) ?? product.media?.[0];
  const secondaryMedia = product.media && product.media.length > 1
    ? product.media.find((m) => !m.isPrimary) ?? product.media[1]
    : undefined;
  const primaryImage = primaryMedia?.url || product.thumbnail || product.images[0] || null;
  const secondaryImage = secondaryMedia?.url || (product.images.length > 1 ? product.images[1] : null);

  const primaryFileId = typeof primaryMedia?.id === 'string' && !primaryMedia.id.startsWith('http')
    ? primaryMedia.id
    : undefined;
  const secondaryFileId = typeof secondaryMedia?.id === 'string' && !secondaryMedia.id.startsWith('http')
    ? secondaryMedia.id
    : undefined;

  const { url: primarySignedUrl } = useSignedFileUrl(primaryFileId, primaryImage);
  const { url: secondarySignedUrl } = useSignedFileUrl(secondaryFileId, secondaryImage);

  const displayImage = isHovered && secondarySignedUrl ? secondarySignedUrl : primarySignedUrl;

  // Calculate available sizes
  // const availableSizes = product.sizeAvailability.filter((s) => s.inStock);
  // const sizesText = availableSizes.length > 0
  //   ? availableSizes.slice(0, 4).map((s) => s.size).join(' · ') + (availableSizes.length > 4 ? ' +' : '')
  //   : null;

  return (
    <article
      className={`
        group relative
        rounded-2xl
        transition-all duration-300 ease-out
        cursor-pointer
        overflow-hidden
        aspect-[4/5]
        ${className}
      `}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-bleed Image Container */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-800/50">
        {/* Skeleton loader */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 animate-pulse">
            <div className="h-full w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800" />
          </div>
        )}

        {/* Product Image */}
        {!imgError && displayImage ? (
          <MediaRenderer
            kind="image"
            src={displayImage}
            alt={product.name}
            fit="cover"
            className={`
              h-full w-full
              transition-all duration-500 ease-out
              ${imgLoaded ? 'opacity-100' : 'opacity-0'}
              ${isHovered ? 'scale-105' : 'scale-100'}
            `}
            mediaClassName="h-full w-full object-cover"
            maxHeightClassName="max-h-full"
            maxWidthClassName="max-w-full"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        ) : (
          /* Fallback for missing/broken images */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-800">
            <ImageOff className="h-12 w-12 text-gray-300 dark:text-zinc-600 mb-2" strokeWidth={1.5} />
            <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
          </div>
        )}
      </div>

      {/* Image overlay gradient for better badge visibility */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-[1]" />

      {/* Status Badges - Top Left */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        {product.isFeatured && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-semibold uppercase tracking-wider shadow-lg shadow-orange-500/25">
            ⭐ Featured
          </span>
        )}
        {product.isOnSale && product.discountPercent && (
          <span className="px-2 py-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-lg shadow-rose-500/25">
            -{product.discountPercent}%
          </span>
        )}
        {product.isLowStock && !product.isOutOfStock && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-semibold shadow-lg shadow-amber-500/25">
            <AlertTriangle size={10} />
            Low Stock
          </span>
        )}
        {ownerStatus && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-lg ${ownerStatus.className}`}
          >
            <span>{ownerStatus.emoji}</span>
            {ownerStatus.label}
          </span>
        )}
        {isCustomAvailable && (
          <div className="relative inline-flex">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowCustomLabel((prev) => !prev);
              }}
              onMouseEnter={() => setShowCustomLabel(true)}
              onMouseLeave={() => setShowCustomLabel(false)}
              onFocus={() => setShowCustomLabel(true)}
              onBlur={() => setShowCustomLabel(false)}
              className="inline-flex items-center justify-center rounded-full bg-purple-500/90 px-2 py-1 text-sm leading-none text-white shadow-lg shadow-purple-500/25"
              aria-label="Custom available"
              title="Custom available"
            >
              <span role="img" aria-hidden="true">{String.fromCodePoint(0x2702, 0xfe0f)}</span>
            </button>
            {showCustomLabel && (
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-full bg-black/80 px-2 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur">
                Custom Available
              </span>
            )}
          </div>
        )}
        {isOwnerView && !product.isOutOfStock && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-semibold">
            <Package size={10} />
            {product.totalStock} in stock
          </span>
        )}
      </div>

      {/* Wishlist Button - Top Right */}
      {!isOwnerView && (
        <button
          type="button"
          onClick={handleWishlistToggle}
          disabled={wishlistLoading || isOwnProduct}
          aria-label={isProductWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          title={
            isOwnProduct
              ? 'Brands cannot wishlist their own products'
              : isProductWishlisted
                ? 'Remove from wishlist'
                : 'Add to wishlist'
          }
          className={`
            absolute top-2 right-2 z-10
            p-2 rounded-full
            transition-all duration-200 ease-out
            ${wishlistLoading || isOwnProduct ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}
          `}
        >
          <span role="img" aria-hidden="true" className="text-base leading-none">
            {isProductWishlisted ? redHeartEmoji : whiteHeartEmoji}
          </span>
        </button>
      )}

      {/* Owner View: Edit Overlay */}
      {isOwnerView && onEdit && (
        <div
          className={`
            absolute inset-0 z-20
            flex items-center justify-center
            bg-black/50 backdrop-blur-sm
            transition-all duration-300
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.(product);
            }}
            className="px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-xl hover:bg-gray-100 transition-all active:scale-95"
          >
            Edit Product
          </button>
        </div>
      )}

      {/* Out of Stock Overlay */}
      {product.isOutOfStock && (
        <div className="absolute inset-0 z-20 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
          <span className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-full shadow-xl">
            Sold Out
          </span>
        </div>
      )}

      {/* Frosted Glass Info Overlay */}
      <div
        className="
          absolute inset-x-0 bottom-0 z-10
          backdrop-blur-xl
          bg-black/30
          border-t border-white/10
          p-3
        "
      >
        <div className="flex flex-col gap-1.5">
          {/* Product Name */}
          <h3 className="text-sm font-semibold text-white line-clamp-1 leading-snug drop-shadow-sm">
            {product.name}
          </h3>

          {/* Brand Name */}
          <p className="text-[11px] text-white/60 line-clamp-1">
            {product.brand.name}
          </p>

          {/* Price Section */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-sm font-bold drop-shadow-sm ${product.isOnSale ? 'text-rose-300' : 'text-white'}`}>
              {formatPrice(product.effectivePrice, product.brand.currency)}
            </span>
            {product.isOnSale && product.salePrice && (
              <span className="text-xs text-white/50 line-through">
                {formatPrice(product.price, product.brand.currency)}
              </span>
            )}
          </div>

          {/* Stock + Action Row */}
          <div className="flex items-center justify-between mt-1">
            {/* Stock indicator */}
            <div className="flex items-center gap-2">
              {!product.isOutOfStock && (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${
                  product.isLowStock ? 'text-amber-300' : 'text-emerald-300'
                }`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    product.isLowStock ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  {product.totalStock} in stock
                </span>
              )}
              <span className="text-[10px] font-medium text-indigo-200/95 inline-flex items-center gap-1">
                <span aria-hidden="true">🧵</span>
                {product.threadsCount ?? 0}
              </span>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Add to Cart Button (Customer View) */}
              {!isOwnerView && (
                <button
                  type="button"
                  onClick={handleQuickAddToCart}
                  disabled={cartLoading || product.isOutOfStock || isOwnProduct}
                  title={
                    isOwnProduct
                      ? 'Brands cannot add their own products to cart'
                      : product.isOutOfStock
                        ? 'Item is out of stock'
                        : 'Add to your shopping cart'
                  }
                  className={`
                    p-2 rounded-lg
                    transition-all duration-200
                    ${product.isOutOfStock || isOwnProduct
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white/90 hover:bg-white/20 hover:text-white active:scale-95'
                    }
                    ${cartLoading ? 'opacity-70 cursor-wait' : ''}
                  `}
                >
                  <ShoppingBag size={16} />
                </button>
              )}

              {/* Owner View: Engagement Stats */}
              {isOwnerView && (
                <>
                  <span className="flex items-center gap-1 text-[10px] text-white/60">
                    <span aria-hidden="true" className={product.threadsCount > 0 ? 'animate-pulse' : ''}>🧵</span>
                    {product.threadsCount}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-white/60">
                    <Eye size={11} />
                    {product.viewsCount}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default StoreProductCard;

