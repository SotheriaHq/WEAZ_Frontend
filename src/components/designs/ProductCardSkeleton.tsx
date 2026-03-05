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
  viewMode: _viewMode = 'grid' 
}) => {
  // Single skeleton card component
  const SkeletonCard = ({ index }: { index: number }) => (
    <div 
      className="
        relative
        rounded-2xl
        overflow-hidden
        aspect-[4/5]
      "
    >
      {/* Full-bleed image skeleton */}
      <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800/50 overflow-hidden">
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
        
        {/* Wishlist button placeholder */}
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-gray-200/60 dark:bg-zinc-700/50" />
        
        {/* Badge placeholder (sometimes shown) */}
        {index % 3 === 0 && (
          <div className="absolute top-3 left-3 w-14 h-6 rounded-full bg-gray-200/60 dark:bg-zinc-700/50" />
        )}
      </div>
      
      {/* Frosted glass info overlay skeleton */}
      <div
        className="
          absolute inset-x-0 bottom-0 z-10
          backdrop-blur-xl
          bg-black/30
          border-t border-white/10
          p-3
        "
      >
        <div className="flex flex-col gap-2">
          {/* Title */}
          <div className="h-4 w-3/4 bg-white/20 rounded-md" />
          {/* Brand name */}
          <div className="h-3 w-1/2 bg-white/15 rounded-md" />
          {/* Price */}
          <div className="h-4 w-20 bg-white/20 rounded-md" />
          {/* Stock + action row */}
          <div className="flex items-center justify-between mt-1">
            <div className="h-3 w-16 bg-white/15 rounded" />
            <div className="w-8 h-8 rounded-lg bg-white/15" />
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
