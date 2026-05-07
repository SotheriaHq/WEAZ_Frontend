import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Modal from '@/components/ui/Modal';
import { featuredApi, type PublicFeaturedItem } from '@/api/FeaturedApi';
import { unwrapApiResponse } from '@/types/auth';
import MediaRenderer from '@/components/media/MediaRenderer';

interface FeaturedGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

const FeaturedGalleryModal: React.FC<FeaturedGalleryModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicFeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await featuredApi.listActive();
        const data = unwrapApiResponse<PublicFeaturedItem[]>(res.data as any);
        if (mounted) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [open]);

  const formatPrice = (item: PublicFeaturedItem) => {
    if (!item.entityPrice) return null;
    const price = Number(item.entityPrice.salePrice ?? item.entityPrice.price);
    if (!Number.isFinite(price)) return null;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: item.entityPrice.currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getThumbnail = (item: PublicFeaturedItem) =>
    item.displayImages?.length ? item.displayImages[0] : item.entityThumbnail;

  const getImages = (item: PublicFeaturedItem) => {
    if (item.useCoverOnly) return [getThumbnail(item)].filter(Boolean) as string[];
    if (item.displayImages?.length) return item.displayImages;
    return [item.entityThumbnail].filter(Boolean) as string[];
  };

  const handleViewItem = (item: PublicFeaturedItem) => {
    onClose();
    if (item.entityType === 'PRODUCT') {
      navigate(`/products/${item.entityId}`);
    } else {
      navigate(`/collections/${item.entityId}`);
    }
  };

  const handleViewBrand = (item: PublicFeaturedItem) => {
    onClose();
    navigate(`/profile/${item.brandId}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="⭐ Featured This Week" size="xl">
      <div className="overflow-y-auto no-scrollbar max-h-[75vh] space-y-6 p-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl">✨</p>
            <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">No featured items right now</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Check back soon for curated picks!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {items.map((item) => {
              const images = getImages(item);
              const hasMultiple = images.length > 1;

              return (
                <motion.div
                  key={item.id}
                  className="group overflow-hidden rounded-2xl border border-amber-200/60 bg-white dark:border-amber-500/20 dark:bg-white/[0.03]"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Image gallery */}
                  <div className={`${hasMultiple ? 'grid grid-cols-3 gap-0.5' : ''}`}>
                    {hasMultiple ? (
                      <>
                        <div className="col-span-2 row-span-2 h-48 overflow-hidden">
                          <MediaRenderer
                            kind="image"
                            src={images[0]}
                            alt={item.entityName}
                            fit="cover"
                            className="h-full w-full"
                            mediaClassName="transition-transform duration-500 group-hover:scale-105"
                            loading="eager"
                          />
                        </div>
                        {images.slice(1, 3).map((url, i) => (
                          <div key={i} className="h-[calc(96px-1px)] overflow-hidden">
                            <MediaRenderer
                              kind="image"
                              src={url}
                              alt={`${item.entityName} ${i + 2}`}
                              fit="cover"
                              className="h-full w-full"
                              loading="eager"
                            />
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="h-48 w-full overflow-hidden">
                        {images[0] ? (
                          <MediaRenderer
                            kind="image"
                            src={images[0]}
                            alt={item.entityName}
                            fit="cover"
                            className="h-full w-full"
                            mediaClassName="transition-transform duration-500 group-hover:scale-105"
                            loading="eager"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-amber-50 text-3xl dark:bg-amber-500/10">⭐</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                          ⭐ Featured {item.entityType === 'PRODUCT' ? 'Product' : 'Design'}
                        </span>
                        <h3 className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{item.entityName}</h3>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          by {item.brand?.name ?? 'Brand'}
                        </p>
                      </div>
                      {formatPrice(item) && (
                        <p className="shrink-0 text-base font-black text-gray-900 dark:text-white">{formatPrice(item)}</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleViewItem(item)}
                        className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                      >
                        👀 View {item.entityType === 'PRODUCT' ? 'Product' : 'Design'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewBrand(item)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                      >
                        Visit Brand
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default FeaturedGalleryModal;
