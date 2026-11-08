import React from 'react';
import { ProductTile } from '@/components/commerce/ProductTile';

interface ProductCardSkeletonProps {
  /** Number of skeleton cards to render (when used directly as a grid) */
  count?: number;
  /** View mode - unused for single skeleton, but kept for backwards compatibility */
  viewMode?: 'grid' | 'list';
  proportion?: 'catalog' | 'studio';
}

/**
 * Skeleton loading state for product cards
 * Matches the new StoreProductCard design for seamless loading transitions
 * 
 * Features:
 * - Natural-height media placeholder with reduced visual weight
 * - Rounded 2xl corners
 * - Shimmer animation effect
 * - Clean, minimal design
 */
const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ 
  count, 
  viewMode: _viewMode = 'grid',
  proportion: _proportion = 'catalog',
}) => {
  // Single skeleton card component
  const SkeletonCard = ({ index }: { index: number }) => (
    /*
      The skeleton occupies the card's exact shape — the shared product tile
      frame, photo on top and a body beneath — so the swap to live content
      moves nothing. Studio, the Shop tab and Market all render the same tile
      now, so `proportion` no longer changes the shape; it is kept so existing
      callers still compile.
    */
    <ProductTile.Root aria-hidden="true">
      <ProductTile.Media className="bg-gray-200 dark:bg-white/10">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
        <div className="absolute right-2.5 top-2.5 h-8 w-8 rounded-full bg-gray-100/70 dark:bg-zinc-700/50" />
        {index % 3 === 0 ? (
          <div className="absolute left-2.5 top-2.5 h-5 w-12 rounded-full bg-gray-100/70 dark:bg-zinc-700/50" />
        ) : null}
      </ProductTile.Media>
      <ProductTile.Body>
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 w-11/12 rounded-md bg-gray-200 dark:bg-white/10" />
          <div className="h-3.5 w-2/3 rounded-md bg-gray-200 dark:bg-white/10" />
          <div className="h-3 w-1/2 rounded-md bg-gray-100 dark:bg-white/[0.06]" />
          <div className="h-4 w-20 rounded-md bg-gray-200 dark:bg-white/10" />
        </div>
        <div className="mt-1.5 h-9 w-full rounded-xl bg-gray-200 dark:bg-white/10" />
      </ProductTile.Body>
    </ProductTile.Root>
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
