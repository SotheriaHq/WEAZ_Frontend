import React, { useState, useCallback } from 'react';
import { ShoppingBag, Eye, ImageOff } from 'lucide-react';
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
        rounded-2xl overflow-hidden
        aspect-[4/5]
        shadow-sm hover:shadow-xl
        transition-all duration-300 ease-out
        cursor-pointer
        ${className}
      `}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-bleed Image */}
      <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800/50">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-800">
            <ImageOff className="h-10 w-10 text-gray-300 dark:text-zinc-600 mb-1.5" strokeWidth={1.5} />
            <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
          </div>
        )}
      </div>

      {/* Status Indicators - Top Left — minimal emoji with hover tooltip */}
      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
        {ownerStatus && (
          <span
            className="group/badge relative text-base leading-none drop-shadow-md cursor-default"
            title={ownerStatus.label}
          >
            {ownerStatus.emoji}
            <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-gray-900/90 backdrop-blur-sm whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none">
              {ownerStatus.label}
            </span>
          </span>
        )}
        {product.isOnSale && product.discountPercent && (
          <span className="px-1.5 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-bold shadow-sm">
            -{product.discountPercent}%
          </span>
        )}
        {product.isLowStock && !product.isOutOfStock && (
          <span
            className="group/badge relative text-base leading-none drop-shadow-md cursor-default"
            title="Low Stock"
          >
            ⚠️
            <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-gray-900/90 backdrop-blur-sm whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none">
              Low Stock
            </span>
          </span>
        )}
        {isOwnerView && !product.isOutOfStock && (
          <span
            className="group/badge relative text-base leading-none drop-shadow-md cursor-default"
            title={`${product.totalStock} in stock`}
          >
            📦
            <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-gray-900/90 backdrop-blur-sm whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none">
              {product.totalStock} in stock
            </span>
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
            absolute top-2.5 right-2.5 z-10
            h-8 w-8 rounded-full
            bg-white/80 dark:bg-black/40 backdrop-blur-sm
            flex items-center justify-center
            shadow-sm border border-white/30 dark:border-white/10
            transition-all duration-200 ease-out
            ${wishlistLoading || isOwnProduct ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}
          `}
        >
          <span role="img" aria-hidden="true" className="text-sm leading-none">
            {isProductWishlisted ? redHeartEmoji : whiteHeartEmoji}
          </span>
        </button>
      )}

      {/* Featured ribbon */}
      {product.isFeatured && (
        <div className="absolute top-0 right-0 z-[5]">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
            Featured
          </div>
        </div>
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
            className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-xl hover:bg-gray-100 transition-all active:scale-95"
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

      {/* Glassmorphism Info Overlay — bottom */}
      <div
        className="
          absolute inset-x-0 bottom-0 z-10
          backdrop-blur-xl
          bg-black/30
          border-t border-white/10
          p-3
        "
      >
        <h3 className="text-sm font-semibold text-white line-clamp-1 leading-snug drop-shadow-sm">
          {product.name}
        </h3>

        <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
          {product.brand.name}
        </p>

        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-bold drop-shadow-sm ${product.isOnSale ? 'text-rose-300' : 'text-white'}`}>
              {formatPrice(product.effectivePrice, product.brand.currency)}
            </span>
            {product.isOnSale && product.salePrice && (
              <span className="text-[11px] text-white/50 line-through">
                {formatPrice(product.price, product.brand.currency)}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1">
            {/* Custom badge */}
            {isCustomAvailable && (
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
                className="inline-flex items-center gap-1 rounded-full bg-purple-500/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                aria-label="Custom available"
                title="Custom available"
              >
                <span role="img" aria-hidden="true">{String.fromCodePoint(0x2702, 0xfe0f)}</span>
                {showCustomLabel && <span>Custom</span>}
              </button>
            )}

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
                      : 'Add to cart'
                }
                className={`
                  h-8 w-8 rounded-lg flex items-center justify-center
                  transition-all duration-200
                  ${product.isOutOfStock || isOwnProduct
                    ? 'text-white/30 cursor-not-allowed'
                    : 'text-white/80 hover:bg-white/15 hover:text-white active:scale-95'
                  }
                  ${cartLoading ? 'opacity-70 cursor-wait' : ''}
                `}
              >
                <ShoppingBag size={15} />
              </button>
            )}

            {isOwnerView && (
              <div className="flex items-center gap-2 text-[10px] text-white/50">
                <span className="inline-flex items-center gap-0.5">
                  <Eye size={10} />
                  {product.viewsCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default StoreProductCard;

