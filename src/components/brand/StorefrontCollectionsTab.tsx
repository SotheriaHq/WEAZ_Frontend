import React from 'react';
import { motion } from 'framer-motion';
import type { CollectionDto } from '@/types/profile';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useNavigate } from 'react-router-dom';

interface StorefrontCollectionsTabProps {
  collections: CollectionDto[];
  loading?: boolean;
}

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
};

export const StorefrontCollectionsTab: React.FC<StorefrontCollectionsTabProps> = ({
  collections,
  loading,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] w-full animate-pulse rounded-[1.5rem] bg-gray-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10">
        <div className="text-center">
          <p className="text-4xl">✨</p>
          <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">No collections yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This designer hasn't featured any groups yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection, i) => (
        <motion.div
          key={collection.id}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={variants}
          whileHover={{ y: -8 }}
          onClick={() => navigate(`/collections/${collection.id}`)}
          className="group cursor-pointer"
        >
          <div className="aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] border border-gray-100 bg-gray-50 shadow-sm transition-shadow hover:shadow-xl dark:border-white/5 dark:bg-zinc-900/40">
            <motion.div className="h-full w-full" whileHover={{ scale: 1.05 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
              <ImageWithFallback
                src={collection.coverImage}
                alt={collection.title || collection.name || 'Collection'}
                fit="cover"
                className="h-full w-full object-cover"
                containerClassName="h-full w-full"
                rounded="none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
            </motion.div>
            
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-6">
              <h3 className="text-2xl font-black text-white drop-shadow-md">
                {collection.title || collection.name}
              </h3>
              {collection.itemCount !== undefined && (
                <span className="mt-2 inline-block rounded-full border border-white/20 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  {collection.itemCount} Items
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
