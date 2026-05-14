import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getBagStatus, type BagStatus } from '@/api/StoreApi';
import { SizeFitApi } from '@/api/SizeFitApi';
import { formatMeasurementLabel } from '@/utils/measurementLabels';

type BagProductInput = {
  id: string;
  name?: string;
};

type BagFittingsModalProps = {
  isOpen: boolean;
  product: BagProductInput | null;
  status: BagStatus | null;
  onClose: () => void;
  onResolved?: (status: BagStatus) => void;
};

const BagFittingsModal: React.FC<BagFittingsModalProps> = ({
  isOpen,
  product,
  status,
  onClose,
  onResolved,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: isOpen,
    onEscape: onClose,
  });

  const missingMeasurements = useMemo(
    () => status?.custom.missingMeasurementKeys ?? [],
    [status?.custom.missingMeasurementKeys],
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError(null);
    setLoading(true);

    void SizeFitApi.getMyProfile()
      .then((profile) => {
        if (!active) return;
        const measurements =
          profile?.measurements && typeof profile.measurements === 'object'
            ? (profile.measurements as Record<string, unknown>)
            : {};
        setValues(
          missingMeasurements.reduce<Record<string, string>>((acc, key) => {
            const parsed = Number(measurements[key]);
            acc[key] = Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
            return acc;
          }, {}),
        );
      })
      .catch(() => {
        if (active) setError('Unable to load your current fittings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, missingMeasurements]);

  const unresolvedMeasurements = useMemo(
    () =>
      missingMeasurements.filter((key) => {
        const parsed = Number(values[key]);
        return !(Number.isFinite(parsed) && parsed > 0);
      }),
    [missingMeasurements, values],
  );

  const handleSave = async () => {
    if (!product || !status) return;
    if (unresolvedMeasurements.length > 0) {
      setError(`Add ${unresolvedMeasurements.length} missing measurement${unresolvedMeasurements.length === 1 ? '' : 's'} to continue.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const profile = await SizeFitApi.getMyProfile().catch(() => null);
      const currentMeasurements =
        profile?.measurements && typeof profile.measurements === 'object'
          ? (profile.measurements as Record<string, unknown>)
          : {};
      const normalised = {
        ...currentMeasurements,
        ...missingMeasurements.reduce<Record<string, { value: number; unit: 'CM' }>>((acc, key) => {
          acc[key] = { value: Number(values[key]), unit: 'CM' };
          return acc;
        }, {}),
      };

      await SizeFitApi.updateProfile({ measurements: normalised });
      const nextStatus = await getBagStatus(product.id);
      toast.success('Fittings updated.');
      onResolved?.(nextStatus);
    } catch (nextError: any) {
      const message =
        nextError?.response?.data?.message ||
        nextError?.message ||
        'Unable to save fittings right now.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

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
                      Add the missing measurements before this custom request can move forward.
                    </p>
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Missing measurements
                    </p>
                    {loading ? (
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading fittings...</p>
                    ) : missingMeasurements.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {missingMeasurements.map((measurement) => (
                          <label key={measurement} className="block space-y-1">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {formatMeasurementLabel(measurement)} (cm)
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={values[measurement] ?? ''}
                              onChange={(event) => {
                                setValues((current) => ({ ...current, [measurement]: event.target.value }));
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                              placeholder="0"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        No measurements are missing, but this request still needs the custom order step.
                      </p>
                    )}
                  </div>

                  {error ? (
                    <p className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>
                  ) : null}

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
                      onClick={() => void handleSave()}
                      disabled={loading || saving || unresolvedMeasurements.length > 0}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      {saving ? 'Saving...' : 'Save fittings'}
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
