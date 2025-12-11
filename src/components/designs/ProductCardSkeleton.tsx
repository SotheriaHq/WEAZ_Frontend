import React from 'react';

interface ProductCardSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'list';
}

/**
 * Skeleton loading state for product cards
 * Matches the design of StoreProductCard for smooth loading transitions
 */
const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ 
  count = 8, 
  viewMode = 'grid' 
}) => {
  return (
    <div 
      className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' 
          : 'grid-cols-1'
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          {/* Image skeleton */}
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
            {/* Wishlist button placeholder */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700" />
            
            {/* Quick add button placeholder */}
            <div className="absolute bottom-3 left-3 right-3 h-10 rounded-lg bg-gray-300/50 dark:bg-gray-700/50" />
          </div>
          
          {/* Product info */}
          <div className="mt-3 space-y-2">
            {/* Title */}
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            
            {/* Brand name */}
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
            
            {/* Price */}
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            
            {/* Size dots */}
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <div 
                  key={j} 
                  className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" 
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductCardSkeleton;
