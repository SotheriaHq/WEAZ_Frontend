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
            className="w-full max-w-lg overflow-hidden rounded-3xl surface-modal shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stale-fitting-title"
          >
            <div className="border-b border-theme px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">
                Fittings review
              </p>
              <h2 id="stale-fitting-title" className="mt-2 text-xl font-bold text-theme">
                Review fittings before bagging
              </h2>
              <p className="mt-2 text-sm leading-6 text-theme-secondary">
                {product?.name || 'This custom request'} will use saved fittings that may be out of date.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                Continuing confirms you want the brand to price and produce this request with the existing fitting values.
              </div>

              <dl className="grid gap-3 text-sm text-theme-secondary">
                <div className="flex items-center justify-between gap-4">
                  <dt>Last updated</dt>
                  <dd className="font-semibold text-theme">
                    {measurementUpdatedAt ? new Date(measurementUpdatedAt).toLocaleDateString() : 'Unknown'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Review due</dt>
                  <dd className="font-semibold text-theme">
                    {staleAt ? new Date(staleAt).toLocaleDateString() : 'Now'}
                  </dd>
                </div>
              </dl>

              {requiredMeasurements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-secondary">
                    Fittings used
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {requiredMeasurements.map((key) => (
                      <span
                        key={key}
                        className="rounded-full surface-control px-3 py-1 text-xs font-semibold"
                      >
                        {formatMeasurementLabel(key)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-theme px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-theme-secondary surface-interactive-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onUpdateFittings}
                className="rounded-2xl border border-theme px-4 py-3 text-sm font-semibold text-theme surface-interactive-hover"
              >
                Update fittings
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="rounded-2xl bg-[color:var(--text-primary)] px-4 py-3 text-sm font-semibold text-[color:var(--surface-primary)] hover:opacity-90"
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
