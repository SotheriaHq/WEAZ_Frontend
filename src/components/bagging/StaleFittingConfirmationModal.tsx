import { AnimatePresence, motion } from 'framer-motion';
import type { BagStatus } from '@/api/StoreApi';
import { formatMeasurementLabel } from '@/utils/measurementLabels';

type BagProductInput = {
  id: string;
  name?: string;
};

type StaleFittingConfirmationModalProps = {
  isOpen: boolean;
  product: BagProductInput | null;
  status: BagStatus | null;
  onUpdateFittings: () => void;
  onContinue: () => void;
  onClose: () => void;
};

export default function StaleFittingConfirmationModal({
  isOpen,
  product,
  status,
  onUpdateFittings,
  onContinue,
  onClose,
}: StaleFittingConfirmationModalProps) {
  const staleAt = status?.custom.staleAt || status?.customOrder?.staleAt || null;
  const measurementUpdatedAt =
    status?.custom.measurementUpdatedAt || status?.customOrder?.measurementUpdatedAt || null;
  const requiredMeasurements = status?.custom.requiredMeasurementKeys ?? [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-layer-modal flex items-end justify-center bg-black/50 px-4 py-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stale-fitting-title"
          >
            <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">
                Fittings review
              </p>
              <h2 id="stale-fitting-title" className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
                Review fittings before bagging
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {product?.name || 'This custom request'} will use saved fittings that may be out of date.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                Continuing confirms you want the brand to price and produce this request with the existing fitting values.
              </div>

              <dl className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between gap-4">
                  <dt>Last updated</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {measurementUpdatedAt ? new Date(measurementUpdatedAt).toLocaleDateString() : 'Unknown'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Review due</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {staleAt ? new Date(staleAt).toLocaleDateString() : 'Now'}
                  </dd>
                </div>
              </dl>

              {requiredMeasurements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Fittings used
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {requiredMeasurements.map((key) => (
                      <span
                        key={key}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200"
                      >
                        {formatMeasurementLabel(key)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onUpdateFittings}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Update fittings
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Continue with existing fittings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
