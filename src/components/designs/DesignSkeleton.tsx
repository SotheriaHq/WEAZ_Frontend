import React from 'react';

interface DesignSkeletonProps {
  count?: number;
}

const DesignSkeleton: React.FC<DesignSkeletonProps> = ({ count = 8 }) => {
  // Use aspect ratios to simulate varied card heights like real images would
  const getRandomAspectRatio = () => {
    const ratios = ['3/4', '4/5', '2/3', '9/16', '1/1'];
    return ratios[Math.floor(Math.random() * ratios.length)];
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="group relative w-full overflow-hidden rounded-lg shadow-lg"
        >
          {/* Image area skeleton using aspect-ratio to match real card behavior */}
          <div 
            className="relative w-full animate-pulse bg-gradient-to-br from-purple-200/40 via-purple-100/30 to-white/30 dark:from-purple-900/30 dark:via-purple-900/10 dark:to-gray-900/30"
            style={{ aspectRatio: getRandomAspectRatio() }}
          />
          
          {/* Gradient Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Tag emoji skeleton (Top Left) */}
          <div className="absolute top-3 left-3 z-20">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/30 backdrop-blur-md" />
          </div>

          {/* Context menu skeleton (Top Right) */}
          <div className="absolute top-3 right-3 z-20">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/30 backdrop-blur-md" />
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
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-4 text-white z-10">
            {/* Brand Info Skeleton */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 w-fit">
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/40 border-2 border-white/60 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-white/40" />
                <div className="h-2 w-14 animate-pulse rounded bg-white/30" />
              </div>
            </div>

            {/* Collection Title Skeleton */}
            <div className="mb-1 space-y-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/40" />
            </div>

            {/* Comment Input Skeleton */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-10 animate-pulse rounded-lg bg-white/30 backdrop-blur-md border border-white/40" />
              <div className="h-3 w-6 animate-pulse rounded bg-white/40" />
            </div>
          </div>
        </article>
      ))}
    </>
  );
};

export default DesignSkeleton;
