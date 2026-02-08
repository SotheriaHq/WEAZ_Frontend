/**
 * Skeleton loading state for InlineProductDetail component.
 * Matches the product detail layout with shimmer animations.
 */
export default function ProductDetailSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Desktop Breadcrumbs Skeleton */}
      <div className="hidden sm:flex items-center gap-2 mb-6">
        <div className="h-4 w-12 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-3 w-3 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-3 w-3 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
      </div>

      {/* Mobile Back Button Skeleton */}
      <div className="sm:hidden flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-5 w-5 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-5 w-5 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* Left Column: Image Gallery Skeleton */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main Image */}
          <div className="aspect-[3/4] w-full rounded-2xl bg-gray-200 dark:bg-white/5" />
          
          {/* Thumbnails */}
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl bg-gray-200 dark:bg-white/10" 
              />
            ))}
          </div>
        </div>

        {/* Right Column: Product Details Skeleton */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Badges */}
          <div className="flex items-center gap-3">
            <div className="h-6 w-16 bg-gray-200 dark:bg-white/10 rounded-full" />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 w-4 bg-gray-200 dark:bg-white/10 rounded" />
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 bg-gray-200 dark:bg-white/10 rounded-lg" />
            <div className="h-8 w-1/2 bg-gray-200 dark:bg-white/10 rounded-lg" />
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <div className="h-9 w-28 bg-gray-200 dark:bg-white/10 rounded-lg" />
            <div className="h-6 w-20 bg-gray-200 dark:bg-white/10 rounded-lg" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 dark:bg-white/10 rounded" />
            <div className="h-4 w-full bg-gray-200 dark:bg-white/10 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-white/10 rounded" />
          </div>

          {/* Color Selector */}
          <div className="space-y-3">
            <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-16 bg-gray-200 dark:bg-white/10 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-white/10 rounded" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-white/10 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Add to Bag */}
          <div className="flex items-center gap-4 pt-2">
            <div className="h-14 w-28 bg-gray-200 dark:bg-white/10 rounded-xl" />
            <div className="flex-1 h-14 bg-gray-200 dark:bg-white/10 rounded-xl" />
          </div>

          {/* Wishlist Button */}
          <div className="hidden sm:block h-12 w-full bg-gray-200 dark:bg-white/10 rounded-xl" />

          {/* Accordion Sections */}
          <div className="pt-4 border-t border-gray-200 dark:border-white/10 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between items-center py-4 border-b border-gray-200 dark:border-white/10">
                <div className="h-5 w-32 bg-gray-200 dark:bg-white/10 rounded" />
                <div className="h-5 w-5 bg-gray-200 dark:bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bar Skeleton */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5 p-4 pb-6 flex items-center gap-3">
        <div className="h-12 w-24 bg-gray-200 dark:bg-white/10 rounded-lg" />
        <div className="flex-1 h-12 bg-gray-200 dark:bg-white/10 rounded-lg" />
      </div>

      {/* Bottom padding for mobile */}
      <div className="sm:hidden h-24" />
    </div>
  );
}
