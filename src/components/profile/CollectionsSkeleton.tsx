import React from 'react';

const aspectRatios = ['3/4', '4/5', '2/3', '9/16', '1/1', '4/5', '3/4', '2/3'];

const CollectionsSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="group relative w-full overflow-hidden rounded-2xl shadow-md"
          style={{ aspectRatio: aspectRatios[index % aspectRatios.length] }}
        >
          {/* Image area skeleton with animated gradient */}
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-purple-200/50 via-gray-100/40 to-purple-100/30 dark:from-purple-900/30 dark:via-gray-800/30 dark:to-gray-900/40" />

          {/* Shimmer overlay */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          </div>

          {/* Gradient overlay from bottom */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

          {/* Tag badge skeleton (Top Left) */}
          <div className="absolute top-3 left-3 z-10">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/25 backdrop-blur-sm" />
          </div>

          {/* Menu skeleton (Top Right) */}
          <div className="absolute top-3 right-3 z-10">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/25 backdrop-blur-sm" />
          </div>

          {/* Action bar skeleton (Right Side) */}
          <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-9 w-9 animate-pulse rounded-full bg-white/20 backdrop-blur-sm border border-white/30" />
                <div className="h-2.5 w-7 animate-pulse rounded bg-white/30" />
              </div>
            ))}
          </div>

          {/* Bottom content overlay skeleton */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 z-10">
            {/* Brand info skeleton */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 animate-pulse rounded-full bg-white/30 border border-white/40 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-white/35" />
                <div className="h-2 w-14 animate-pulse rounded bg-white/25" />
              </div>
            </div>

            {/* Title skeleton */}
            <div className="mb-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/35" />
            </div>

            {/* Comment input skeleton */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 animate-pulse rounded-lg bg-white/20 backdrop-blur-sm border border-white/30" />
              <div className="h-3 w-5 animate-pulse rounded bg-white/30" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default CollectionsSkeleton;
