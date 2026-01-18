import React, { useState, useCallback } from 'react';
import { Heart, ShoppingBag, Eye, ImageOff, Sparkles, AlertTriangle, Package } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { toast } from 'sonner';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';

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
  sizeAvailability: { size: string; inStock: boolean; quantity: number }[];
  colors: string[];
  totalStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isFeatured: boolean;
  likesCount: number;
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
  isWishlisted: initialWishlisted = false,
  className = '',
  isOwnerView = false,
  onEdit,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  // Check if product is wishlisted from Redux state
  const isProductWishlisted = wishlistedIds.has(product.id) || isWishlisted;

  const formatPrice = useCallback((price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }, []);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) {
      toast.info('Please sign in to use wishlist');
      return;
    }

    setWishlistLoading(true);
    try {
      if (isProductWishlisted) {
        await dispatch(removeFromWishlist(product.id)).unwrap();
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        await dispatch(addToWishlist(product.id)).unwrap();
        setIsWishlisted(true);
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
    if (!isAuth) {
      toast.info('Please sign in to add to cart');
      return;
    }

    if (product.isOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    // If product has sizes, open product detail for selection
    if (product.sizes.length > 0) {
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
  const availableSizes = product.sizeAvailability.filter((s) => s.inStock);
  const sizesText = availableSizes.length > 0
    ? availableSizes.slice(0, 4).map((s) => s.size).join(' · ') + (availableSizes.length > 4 ? ' +' : '')
    : null;

  return (
    <article
      className={`
        group relative flex flex-col
        bg-white dark:bg-zinc-900/80
        rounded-2xl
        border border-gray-100 dark:border-white/[0.08]
        shadow-sm
        hover:shadow-xl hover:shadow-black/[0.08] dark:hover:shadow-black/30
        hover:border-gray-200 dark:hover:border-white/[0.12]
        transition-all duration-300 ease-out
        cursor-pointer
        overflow-hidden
        ${className}
      `}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container - Fixed 4:5 aspect ratio for fashion */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50 dark:bg-zinc-800/50">
        {/* Skeleton loader */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 animate-pulse">
            <div className="h-full w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800" />
          </div>
        )}

        {/* Product Image */}
        {!imgError && displayImage ? (
          <img
            src={displayImage}
            alt={product.name}
            className={`
              h-full w-full object-cover
              transition-all duration-500 ease-out
              ${imgLoaded ? 'opacity-100' : 'opacity-0'}
              ${isHovered ? 'scale-105' : 'scale-100'}
            `}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
            loading="lazy"
          />
        ) : (
          /* Fallback for missing/broken images */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-800">
            <ImageOff className="h-12 w-12 text-gray-300 dark:text-zinc-600 mb-2" strokeWidth={1.5} />
            <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
          </div>
        )}

        {/* Image overlay gradient for better badge visibility */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />

        {/* Status Badges - Top Left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.isFeatured && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-semibold uppercase tracking-wider shadow-lg shadow-orange-500/25">
              <Sparkles size={10} />
              New
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
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-label={isProductWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`
              absolute top-3 right-3 z-10
              p-2.5 rounded-full
              backdrop-blur-md
              transition-all duration-200 ease-out
              ${isProductWishlisted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-white/80 dark:bg-black/40 text-gray-700 dark:text-white hover:bg-white dark:hover:bg-black/60'
              }
              ${wishlistLoading ? 'opacity-50 cursor-wait' : 'hover:scale-110 active:scale-95'}
            `}
          >
            <Heart
              size={18}
              className={`transition-transform duration-200 ${isProductWishlisted ? 'fill-current' : ''}`}
            />
          </button>
        )}

        {/* Quick Add to Cart - Hover Overlay (Customer View Only) */}
        {!isOwnerView && (
          <div
            className={`
              absolute bottom-0 left-0 right-0
              p-4 pt-16
              bg-gradient-to-t from-black/70 via-black/40 to-transparent
              transform transition-all duration-300 ease-out
              ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
            `}
          >
            <button
              onClick={handleQuickAddToCart}
              disabled={cartLoading || product.isOutOfStock}
              className={`
                w-full py-3 px-4 rounded-xl
                font-semibold text-sm
                flex items-center justify-center gap-2
                transition-all duration-200
                ${product.isOutOfStock
                  ? 'bg-gray-400/80 text-white/80 cursor-not-allowed'
                  : 'bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.98] shadow-lg'
                }
                ${cartLoading ? 'opacity-70 cursor-wait' : ''}
              `}
            >
              <ShoppingBag size={16} />
              {product.isOutOfStock
                ? 'Out of Stock'
                : product.sizes.length > 0
                  ? 'Select Options'
                  : 'Add to Bag'
              }
            </button>
          </div>
        )}

        {/* Owner View: Edit Overlay */}
        {isOwnerView && (
          <div
            className={`
              absolute inset-0
              flex items-center justify-center
              bg-black/50 backdrop-blur-sm
              transition-all duration-300
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <button
              onClick={(e) => {
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
          <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-full shadow-xl">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex flex-col gap-2 p-4">
        {/* Product Name */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Price Section */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-lg font-bold ${product.isOnSale ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
            {formatPrice(product.effectivePrice, product.brand.currency)}
          </span>
          {product.isOnSale && product.salePrice && (
            <span className="text-sm text-gray-400 dark:text-gray-500 line-through">
              {formatPrice(product.price, product.brand.currency)}
            </span>
          )}
        </div>

        {/* Quick Add (always visible for customers) */}
        {!isOwnerView && (
          <button
            onClick={handleQuickAddToCart}
            disabled={cartLoading || product.isOutOfStock}
            className={`mt-1 w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
              product.isOutOfStock
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98]'
            } ${cartLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            <ShoppingBag size={16} />
            {product.isOutOfStock
              ? 'Out of Stock'
              : product.sizes.length > 0
                ? 'Select Options'
                : 'Add to Bag'}
          </button>
        )}

        {/* Available Sizes */}
        {sizesText && !isOwnerView && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Sizes: {sizesText}
          </p>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center gap-4 mt-auto pt-2 border-t border-gray-100 dark:border-white/5">
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Heart size={12} className={product.likesCount > 0 ? 'text-rose-400' : ''} />
            <span>{product.likesCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Eye size={12} />
            <span>{product.viewsCount}</span>
          </span>
          {/* Stock indicator for owner view */}
          {isOwnerView && (
            <span className={`ml-auto text-xs font-medium ${
              product.isOutOfStock
                ? 'text-rose-500'
                : product.isLowStock
                  ? 'text-amber-500'
                  : 'text-emerald-500'
            }`}>
              {product.isOutOfStock ? 'Out of stock' : `${product.totalStock} left`}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default StoreProductCard;
