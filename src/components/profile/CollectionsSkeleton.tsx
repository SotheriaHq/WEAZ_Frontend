import React from 'react';

const placeholderHeights = [320, 360, 420, 380];

const CollectionsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => {
        const height = placeholderHeights[index % placeholderHeights.length];
        return (
          <div
            key={index}
            className="glass-panel animate-pulse rounded-2xl border border-white/20 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/10"
            style={{ height }}
          />
        );
      })}
    </div>
  );
};

export default CollectionsSkeleton;
