import { AnimatePresence, motion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import type { StoreProduct } from '@/components/designs/StoreProductCard';

export default function MarketProductOverlay({ product, onClose }: {
  product: StoreProduct | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
        {product && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-modal bg-black/60 p-3 backdrop-blur-sm wiez-lg-backdrop sm:p-6 flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mx-auto max-h-[92vh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-3xl border border-theme bg-[color:var(--surface-primary)] p-4 shadow-2xl sm:p-6 glass-scrollbar flex flex-col"
              >
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="wiez-lg-surface wiez-lg-subtle wiez-lg-interactive rounded-full px-3 py-1.5 text-xs font-semibold"
                  >
                    ✖ Close
                  </button>
                </div>
                <InlineProductDetail
                  product={product}
                  onBack={onClose}
                  brandName={product.brand?.name}
                />
              </motion.div>
            </motion.div>
          </OverlayPortal>
        )}
    </AnimatePresence>
  );
}
