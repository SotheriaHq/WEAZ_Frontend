import React from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { ProductDto } from '@/api/ProductApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useNavigate } from 'react-router-dom';

interface StorefrontCatalogTabProps {
  products?: ProductDto[];
  loading?: boolean;
}

const variants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
};

export const StorefrontCatalogTab: React.FC<StorefrontCatalogTabProps> = ({
  products = [],
  loading,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-gray-200/60 dark:bg-zinc-800/60" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200/60 dark:bg-zinc-800/60" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200/60 dark:bg-zinc-800/60" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-[2rem] bg-gray-50/50 dark:bg-white/[0.03]">
        <div className="text-center">
          <p className="text-4xl">🛍️</p>
          <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Catalog empty</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This designer hasn't added any products to their catalog yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
      {products.map((product, i) => {
        const coverMedia = product.media?.find((m) => m.isPrimary) || product.media?.[0];

        return (
          <motion.div
            key={product.id}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={variants}
            onClick={() => navigate(`/products/${product.id}`)}
            className="group flex cursor-pointer flex-col"
          >
            <div className="relative aspect-[3/4] w-full origin-bottom overflow-hidden rounded-[1.5rem] bg-gray-100 shadow-sm transition-all duration-300 group-hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] dark:bg-zinc-800/40">
              <motion.div
                className="h-full w-full"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
              >
                <ImageWithFallback
                  src={coverMedia?.url}
                  alt={product.title}
                  fit="cover"
                  className="h-full w-full object-cover"
                  containerClassName="h-full w-full"
                  rounded="none"
                />
              </motion.div>
              {/* Optional: Add "Quick View" overlay button here later */}
              <div className="pointer-events-none absolute inset-0 bg-black/0 opacity-0 transition-opacity duration-300 group-hover:bg-black/5 group-hover:opacity-100 dark:group-hover:bg-white/5" />
            </div>

            <div className="mt-4 flex flex-1 flex-col px-1">
              <h4 className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
                {product.title}
              </h4>
              <div className="mt-auto pt-2">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {product.currency || 'NGN'} {(product.price || 0).toLocaleString()}
                </span>
                {product.compareAtPrice && product.compareAtPrice > (product.price || 0) && (
                  <span className="ml-2 text-xs font-medium text-gray-500 line-through dark:text-gray-400">
                    {product.currency || 'NGN'} {product.compareAtPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
