import React from 'react';

interface ProductCardSkeletonProps {
  /** Number of skeleton cards to render (when used directly as a grid) */
  count?: number;
  /** View mode - unused for single skeleton, but kept for backwards compatibility */
  viewMode?: 'grid' | 'list';
}

/**
 * Skeleton loading state for product cards
 * Matches the new StoreProductCard design for seamless loading transitions
 * 
 * Features:
 * - 4:5 aspect ratio image placeholder (matches product card)
 * - Rounded 2xl corners
 * - Shimmer animation effect
 * - Clean, minimal design
 */
const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ 
  count, 
  viewMode = 'grid' 
}) => {
  // Single skeleton card component
  const SkeletonCard = ({ index }: { index: number }) => (
    <div 
      className="
        flex flex-col
        bg-white dark:bg-zinc-900/80
        rounded-2xl
        border border-gray-100 dark:border-white/[0.08]
        shadow-sm
        overflow-hidden
      "
    >
      {/* Image skeleton - 4:5 aspect ratio to match product card */}
      <div className="relative aspect-[4/5] bg-gray-100 dark:bg-zinc-800/50 overflow-hidden">
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
        
        {/* Wishlist button placeholder */}
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-gray-200/60 dark:bg-zinc-700/50" />
        
        {/* Badge placeholder (sometimes shown) */}
        {index % 3 === 0 && (
          <div className="absolute top-3 left-3 w-14 h-6 rounded-full bg-gray-200/60 dark:bg-zinc-700/50" />
        )}
      </div>
      
      {/* Product info skeleton */}
      <div className="flex flex-col gap-3 p-4">
        {/* Title - 2 lines */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 dark:bg-zinc-700 rounded-md" />
          <div className="h-4 w-2/3 bg-gray-200 dark:bg-zinc-700 rounded-md" />
        </div>
        
        {/* Price */}
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 bg-gray-200 dark:bg-zinc-700 rounded-md" />
          <div className="h-4 w-16 bg-gray-100 dark:bg-zinc-800 rounded-md" />
        </div>
        
        {/* Sizes text */}
        <div className="h-3 w-28 bg-gray-100 dark:bg-zinc-800 rounded" />
        
        {/* Stats row with divider */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="w-6 h-3 bg-gray-200 dark:bg-zinc-700 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="w-6 h-3 bg-gray-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  // If count is provided, render a grid of skeletons
  if (count && count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </>
    );
  }

  // Single skeleton card
  return <SkeletonCard index={0} />;
};

export default ProductCardSkeleton;
