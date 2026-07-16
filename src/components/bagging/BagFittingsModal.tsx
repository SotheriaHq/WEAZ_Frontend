import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getBagStatus, type BagStatus } from '@/api/StoreApi';
import { BagApi, type BagSourceType } from '@/api/BagApi';
import { SizeFitApi } from '@/api/SizeFitApi';
import { formatMeasurementLabel } from '@/utils/measurementLabels';

type BagProductInput = {
  id: string;
  name?: string;
  sourceType?: BagSourceType;
  sourceId?: string;
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
  const staleMeasurements = useMemo(() => {
    const custom = status?.custom;
    if (!custom) return [];
    if (Array.isArray(custom.veryStaleMeasurementKeys) && custom.veryStaleMeasurementKeys.length > 0) {
      return custom.veryStaleMeasurementKeys;
    }
    if (Array.isArray(custom.staleMeasurementKeys) && custom.staleMeasurementKeys.length > 0) {
      return custom.staleMeasurementKeys;
    }
    return custom.freshnessState === 'STALE' || custom.freshnessState === 'VERY_STALE'
      ? custom.requiredMeasurementKeys
      : [];
  }, [status?.custom]);
  const measurementsToEdit = useMemo(
    () => (missingMeasurements.length > 0 ? missingMeasurements : staleMeasurements),
    [missingMeasurements, staleMeasurements],
  );
  const isRefreshingStaleMeasurements =
    missingMeasurements.length === 0 && staleMeasurements.length > 0;

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
          measurementsToEdit.reduce<Record<string, string>>((acc, key) => {
            const raw = measurements[key];
            const value =
              raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)
                ? (raw as Record<string, unknown>).value
                : raw;
            const parsed = Number(value);
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
  }, [isOpen, measurementsToEdit]);

  const unresolvedMeasurements = useMemo(
    () =>
      measurementsToEdit.filter((key) => {
        const parsed = Number(values[key]);
        return !(Number.isFinite(parsed) && parsed > 0);
      }),
    [measurementsToEdit, values],
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
        ...measurementsToEdit.reduce<Record<string, { value: number; unit: 'CM' }>>((acc, key) => {
          acc[key] = { value: Number(values[key]), unit: 'CM' };
          return acc;
        }, {}),
      };

      await SizeFitApi.updateProfile({ measurements: normalised });
      const nextStatus =
        product.sourceType && product.sourceType !== 'PRODUCT'
          ? await BagApi.getSourceBagStatus(product.sourceType, product.sourceId ?? product.id)
          : await getBagStatus(product.id);
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
              className="fixed inset-0 z-layer-modal flex items-end justify-center px-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Complete fittings for ${product.name || 'this item'}`}
            >
              <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative flex max-h-[min(85dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-[22px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950 sm:max-h-[min(88vh,720px)] sm:rounded-[28px]"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500" />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-3 top-3 z-10 rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 sm:right-4 sm:top-4"
                  aria-label="Close fittings"
                >
                  <span aria-hidden="true" className="text-lg leading-none text-slate-500">x</span>
                </button>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 md:p-8">
                  <div className="space-y-1.5 pr-10 sm:space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 sm:text-xs sm:tracking-[0.24em]">
                      Fittings required
                    </p>
                    <h2 className="text-lg font-semibold leading-snug text-slate-950 dark:text-white sm:text-2xl">
                      Finish measurements for {product.name || 'this item'}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                      {isRefreshingStaleMeasurements
                        ? 'Refresh only the stale measurements needed for this request.'
                        : 'Add the missing measurements before this request can move forward.'}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5 sm:mt-6 sm:rounded-3xl sm:p-4">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                      {isRefreshingStaleMeasurements ? 'Measurements to refresh' : 'Missing measurements'}
                    </p>
                    {loading ? (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 sm:mt-3 sm:text-sm">Loading fittings...</p>
                    ) : measurementsToEdit.length > 0 ? (
                      <div className="mt-2 grid grid-cols-1 gap-2.5 sm:mt-3 sm:grid-cols-2 sm:gap-3">
                        {measurementsToEdit.map((measurement) => (
                          <label key={measurement} className="block space-y-1">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 sm:text-xs">
                              {formatMeasurementLabel(measurement)} (cm)
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={values[measurement] ?? ''}
                              onChange={(event) => {
                                setValues((current) => ({ ...current, [measurement]: event.target.value }));
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white sm:rounded-2xl sm:px-4 sm:py-3"
                              placeholder="0"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                        No measurements are missing, but this request still needs the next bagging step.
                      </p>
                    )}
                  </div>

                  {error ? (
                    <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-300 sm:mt-4 sm:text-sm">{error}</p>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-950 sm:p-3">
                  <div className="flex flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 sm:min-h-11 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={loading || saving || unresolvedMeasurements.length > 0}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:min-h-11 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
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
