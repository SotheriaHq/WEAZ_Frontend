import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { BagStatus } from '@/api/StoreApi';

type BagProductInput = {
  id: string;
  name?: string;
};

type BagFittingsModalProps = {
  isOpen: boolean;
  product: BagProductInput | null;
  status: BagStatus | null;
  onClose: () => void;
  onContinue?: () => void;
};

const BagFittingsModal: React.FC<BagFittingsModalProps> = ({
  isOpen,
  product,
  status,
  onClose,
  onContinue,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: isOpen,
    onEscape: onClose,
  });

  const missingMeasurements = useMemo(
    () => status?.custom.missingMeasurementKeys ?? [],
    [status?.custom.missingMeasurementKeys],
  );

  return (
    <AnimatePresence>
      {isOpen && product && status && (
        <OverlayPortal>
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-overlay bg-black/55 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Complete fittings for ${product.name || 'this item'}`}
            >
              <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500" />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Close fittings"
                >
                  <span aria-hidden="true" className="text-lg leading-none text-slate-500">x</span>
                </button>

                <div className="p-6 sm:p-8">
                  <div className="space-y-3 pr-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                      Fittings required
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                      Finish the measurements for {product.name || 'this item'}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      We need a few measurements before this custom request can move forward.
                    </p>
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Missing measurements
                    </p>
                    {missingMeasurements.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {missingMeasurements.map((measurement) => (
                          <li
                            key={measurement}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                          >
                            {measurement}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        No measurements are missing, but this request still needs the custom order step.
                      </p>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={onContinue}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      Continue to custom order
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        </OverlayPortal>
      )}
    </AnimatePresence>
  );
};

export default BagFittingsModal;
