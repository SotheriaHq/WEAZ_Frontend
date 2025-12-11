import React, { useState } from 'react';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { toast } from 'sonner';

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
}

export const StoreProductCard: React.FC<StoreProductCardProps> = ({
  product,
  onViewProduct,
  isWishlisted: initialWishlisted = false,
  className,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);
  
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  // Check if product is wishlisted from Redux state
  const isProductWishlisted = wishlistedIds.has(product.id) || isWishlisted;

  const formatPrice = (price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

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

  // Determine which image to show (hover shows second image if available)
  const displayImage = isHovered && product.images.length > 1 
    ? product.images[1] 
    : product.thumbnail || product.images[0];

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl bg-white/5 dark:bg-white/[0.03] backdrop-blur-sm border border-white/10 dark:border-white/5 transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)] cursor-pointer ${className ?? ''}`}
      onClick={() => onViewProduct?.(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-900">
        {/* Loading skeleton */}
        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-purple-100/20 via-white/10 to-gray-200/20 dark:from-purple-900/20 dark:via-gray-800/20 dark:to-gray-900/40" />
        )}
        
        {/* Product image */}
        <img
          src={displayImage}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'} ${isHovered ? 'scale-105' : 'scale-100'}`}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-product.png';
          }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {product.isFeatured && (
            <span className="px-2.5 py-1 rounded-full bg-purple-600 text-white text-[10px] font-semibold uppercase tracking-wide">
              New
            </span>
          )}
          {product.isOnSale && product.discountPercent && (
            <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
              -{product.discountPercent}%
            </span>
          )}
          {product.isLowStock && !product.isOutOfStock && (
            <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold">
              Low Stock
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          disabled={wishlistLoading}
          className={`absolute top-3 right-3 z-10 p-2.5 rounded-full backdrop-blur-md transition-all duration-200 ${
            isProductWishlisted
              ? 'bg-red-500 text-white'
              : 'bg-black/30 dark:bg-white/10 text-white hover:bg-black/50 dark:hover:bg-white/20'
          } ${wishlistLoading ? 'opacity-50 cursor-wait' : ''}`}
        >
          <Heart
            size={18}
            className={isProductWishlisted ? 'fill-current' : ''}
          />
        </button>

        {/* Quick Add to Cart - Shows on Hover */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transform transition-all duration-300 ${
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        >
          <button
            onClick={handleQuickAddToCart}
            disabled={cartLoading || product.isOutOfStock}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              product.isOutOfStock
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            } ${cartLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            <ShoppingCart size={16} />
            {product.isOutOfStock ? 'Out of Stock' : product.sizes.length > 0 ? 'Select Size' : 'Add to Cart'}
          </button>
        </div>

        {/* Out of Stock Overlay */}
        {product.isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-4 py-2 bg-black/80 text-white text-sm font-medium rounded-lg">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex flex-col gap-2 p-4">
        {/* Product Name */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight">
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatPrice(product.effectivePrice, product.brand.currency)}
          </span>
          {product.isOnSale && product.salePrice && (
            <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
              {formatPrice(product.price, product.brand.currency)}
            </span>
          )}
        </div>

        {/* Size Availability Dots */}
        {product.sizeAvailability.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {product.sizeAvailability.slice(0, 6).map((sa) => (
              <span
                key={sa.size}
                className={`w-2 h-2 rounded-full ${
                  sa.inStock 
                    ? 'bg-green-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={`${sa.size}: ${sa.inStock ? 'In Stock' : 'Out of Stock'}`}
              />
            ))}
          </div>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Heart size={12} />
            {product.likesCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {product.viewsCount}
          </span>
        </div>
      </div>
    </article>
  );
};

export default StoreProductCard;
