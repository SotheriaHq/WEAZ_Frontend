import React from 'react';

interface MarketSkeletonProps {
  count?: number;
}

const MarketSkeleton: React.FC<MarketSkeletonProps> = ({ count = 8 }) => {
  // Generate random heights to simulate masonry layout
  const getRandomHeight = () => {
    const heights = [320, 380, 420, 480, 520];
    return heights[Math.floor(Math.random() * heights.length)];
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="group relative w-full overflow-hidden rounded-lg shadow-lg"
          style={{ minHeight: `${getRandomHeight()}px` }}
        >
          {/* Full Image Background Skeleton */}
          <div 
            className="relative w-full h-full animate-pulse bg-gradient-to-br from-purple-200/40 via-purple-100/30 to-white/30 dark:from-purple-900/30 dark:via-purple-900/10 dark:to-gray-900/30"
            style={{ minHeight: '280px' }}
          />
          
          {/* Gradient Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Price Badge Skeleton (Top Right) */}
          <div className="absolute top-3 right-3 z-20">
            <div className="h-7 w-24 animate-pulse rounded-full bg-white/30 backdrop-blur-md border border-white/40" />
          </div>

          {/* Tags Skeleton (Top Left) */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
            {Array.from({ length: 2 }).map((__, tagIndex) => (
              <div 
                key={tagIndex}
                className="h-6 w-16 animate-pulse rounded-full bg-primary/60 backdrop-blur-sm"
              />
            ))}
          </div>

          {/* Vertical Action Bar Skeleton (Right Side) */}
          <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
            {Array.from({ length: 2 }).map((__, actionIndex) => (
              <div key={actionIndex} className="flex flex-col items-center">
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/30 backdrop-blur-md border border-white/40" />
                <div className="h-3 w-8 mt-1 animate-pulse rounded bg-white/40" />
              </div>
            ))}
          </div>

          {/* Bottom Content Overlay Skeleton */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
            {/* Brand Info Skeleton */}
            <div className="flex items-center gap-2.5 mb-3 w-fit rounded-lg bg-gradient-to-r from-primary/60 to-purple-600/60 backdrop-blur-xl border border-white/30 px-3 py-2">
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/40 border-2 border-white/60" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-3 w-24 animate-pulse rounded bg-white/40" />
                <div className="h-2 w-16 animate-pulse rounded bg-white/30" />
              </div>
            </div>

            {/* Collection Title Skeleton */}
            <div className="mb-2 space-y-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/40" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/30" />
            </div>

            {/* Comment Input Skeleton */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-10 animate-pulse rounded-lg bg-white/30 backdrop-blur-md border border-white/40" />
              <div className="h-3 w-8 animate-pulse rounded bg-white/40" />
            </div>
          </div>
        </article>
      ))}
    </>
  );
};

export default MarketSkeleton;
