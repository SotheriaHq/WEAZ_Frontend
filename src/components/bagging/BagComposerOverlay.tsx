import { AnimatePresence, motion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';

export default function BagComposerOverlay({ configurationId, onClose }: {
  configurationId: string | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
        {configurationId && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-modal flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
              onClick={onClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 16 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="relative flex h-full w-full max-w-6xl overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-[28px] dark:bg-slate-950"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="h-full w-full overflow-y-auto">
                  <LazyCustomOrderComposerPage
                    configurationIdOverride={configurationId}
                    embedded
                    onClose={onClose}
                  />
                </div>
              </motion.div>
            </motion.div>
          </OverlayPortal>
        )}
    </AnimatePresence>
  );
}
