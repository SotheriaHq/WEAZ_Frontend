import React, { useEffect } from "react";
import { X, Tag as TagIcon, Eye, Link2, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketMedia } from "@/types/market";
import { formatPrice } from "@/utils/helpers";
import MediaRenderer from "@/components/media/MediaRenderer";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// Minimal shape derived from backend /collections/:id
type CollectionDetail = {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  threadsCount?: number | null;
  commentsCount?: number | null;
};

type Props = {
  open: boolean;
  collection: CollectionDetail | null;
  media: MarketMedia[];
  onClose: () => void;
  onViewMedia?: (mediaId: string) => void;
};

const CollectionViewModal: React.FC<Props> = ({ open, collection, media, onClose, onViewMedia }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  // Scroll Locking
  useEffect(() => {
    if (open) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [open]);

  // Early return if not open or no collection
  if (!open || !collection) return null;

  // Use collection data
  const title = collection.title;
  const mediaCount = media?.length || 0;
  const priceRange = (() => {
    const min = collection.minPrice ? formatPrice(collection.minPrice) : null;
    const max = collection.maxPrice ? formatPrice(collection.maxPrice) : null;
    if (min && max && min !== max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  return (
    <OverlayPortal>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop with unified gradient blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-overlay"
              onClick={onClose}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-purple-50/60 to-white/70 dark:from-purple-900/40 dark:via-indigo-900/50 dark:to-blue-900/40" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-black/30 dark:bg-black/40" />
            </motion.div>

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-4 md:inset-8 lg:inset-12 z-layer-modal flex items-center justify-center"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div
                ref={dialogRef}
                tabIndex={-1}
                className="w-full max-w-4xl max-h-full neu-modal-surface bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/70 dark:border-white/10 overflow-hidden flex flex-col text-gray-900 dark:text-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {title}
                  </h2>
                  {collection.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3">
                    {priceRange && (
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {priceRange}
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Eye size={14} /> {mediaCount} items
                      </span>
                      {collection.threadsCount && collection.threadsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Link2 size={14} /> {collection.threadsCount}
                        </span>
                      )}
                      {collection.commentsCount && collection.commentsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle size={14} /> {collection.commentsCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {collection.tags && collection.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {collection.tags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400"
                        >
                          <TagIcon size={10} />
                          {tag}
                        </span>
                      ))}
                      {collection.tags.length > 5 && (
                        <span className="text-xs text-gray-400">
                          +{collection.tags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-4"
                >
                  <X size={22} className="text-gray-500" />
                </button>
              </div>

              {/* Media Grid */}
              <div className="flex-1 overflow-y-auto p-6 overscroll-contain">
                {mediaCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                      <Eye size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No media yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      This collection doesn't have any items
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {media.map((item) => (
                      <button
                        key={item.fileId}
                        onClick={() => onViewMedia?.(item.fileId)}
                        className="group relative rounded-2xl overflow-hidden hover:ring-2 ring-purple-500 transition-all"
                      >
                        <MediaRenderer
                          kind="image"
                          src={item.url || ''}
                          alt=""
                          maxHeightClassName="max-h-48"
                          className="rounded-2xl"
                          mediaClassName="rounded-2xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default CollectionViewModal;
