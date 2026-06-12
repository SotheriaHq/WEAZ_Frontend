import React, { useEffect, useMemo, useState } from 'react';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import type { SizeFitProfile } from '@/types/sizeFit';

interface EndUserSizeFitModalProps {
  open: boolean;
  loading: boolean;
  saving: boolean;
  profile: SizeFitProfile | null;
  onClose: () => void;
  onSaveMeasurements: (payload: {
    measurements: Record<string, unknown>;
    notes?: string;
    requireUpdateEveryDays?: number;
    preferredLengthUnit?: 'CM' | 'IN';
  }) => Promise<void>;
  onSaveSettings: (payload: {
    visibility?: 'PUBLIC' | 'PRIVATE';
    sharePolicy?: 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
    notifyOnShare?: boolean;
    requireUpdateEveryDays?: number;
  }) => Promise<void>;
}

export const EndUserSizeFitModal: React.FC<EndUserSizeFitModalProps> = ({
  open,
  loading,
  saving,
  profile,
  onClose,
  onSaveMeasurements,
  onSaveSettings,
}) => {
  const toInches = (cm: number) => cm / 2.54;
  const toCentimeters = (inch: number) => inch * 2.54;
  const round = (value: number) => Math.round(value * 100) / 100;

  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [lengthUnit, setLengthUnit] = useState<'CM' | 'IN'>('CM');
  const [reminderDays, setReminderDays] = useState(14);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [sharePolicy, setSharePolicy] = useState<
    'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE'
  >('REQUIRE_PERMISSION');
  const [notifyOnShare, setNotifyOnShare] = useState(true);
  const baselinePoints = useMemo(
    () => profile?.baselineMeasurementPoints ?? [],
    [profile?.baselineMeasurementPoints],
  );
  const missingBaselineKeys = useMemo(
    () => profile?.missingBaselineKeys ?? [],
    [profile?.missingBaselineKeys],
  );

  useEffect(() => {
    if (!profile) return;
    const nextValues: Record<string, string> = {};
    const preferredLengthUnit = profile.preferredLengthUnit ?? 'CM';
    setLengthUnit(preferredLengthUnit);
    for (const point of baselinePoints) {
      const raw = profile.measurements?.[point.key];
      if (typeof raw === 'number') {
        nextValues[point.key] =
          preferredLengthUnit === 'IN'
            ? String(round(toInches(raw)))
            : String(raw);
        continue;
      }
      nextValues[point.key] = typeof raw === 'string' ? raw : '';
    }
    setValues(nextValues);
    setNotes(profile.notes ?? '');
    setReminderDays(profile.requireUpdateEveryDays ?? 14);
    setVisibility(profile.visibility);
    setSharePolicy(profile.sharePolicy);
    setNotifyOnShare(profile.notifyOnShare);
  }, [baselinePoints, profile]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleSaveMeasurements = async () => {
    const measurements: Record<string, unknown> = {};
    for (const point of baselinePoints) {
      const value = values[point.key] ?? '';
      if (!value.trim()) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        measurements[point.key] =
          lengthUnit === 'IN'
            ? round(toCentimeters(parsed))
            : parsed;
      } else {
        measurements[point.key] = value.trim();
      }
    }
    await onSaveMeasurements({
      measurements,
      notes,
      requireUpdateEveryDays: reminderDays,
      preferredLengthUnit: lengthUnit,
    });
  };

  const handleLengthUnitChange = (nextUnit: 'CM' | 'IN') => {
    if (nextUnit === lengthUnit) return;
    setValues((current) => {
      const converted: Record<string, string> = { ...current };
      for (const point of baselinePoints) {
        const raw = current[point.key];
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) continue;
        converted[point.key] =
          nextUnit === 'IN'
            ? String(round(toInches(parsed)))
            : String(round(toCentimeters(parsed)));
      }
      return converted;
    });
    setLengthUnit(nextUnit);
  };

  const handleSaveSettings = async () => {
    await onSaveSettings({
      visibility,
      sharePolicy,
      notifyOnShare,
      requireUpdateEveryDays: reminderDays,
    });
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close custom size fits modal"
        />

        <section className="relative z-10 w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl neu-modal-surface shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center h-9 w-9 rounded-xl neu-modal-inset focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Close"
          >
            <span className="text-[color:var(--neu-text-muted)]" aria-hidden="true">✕</span>
          </button>

          <div className="p-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 pr-10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white grid place-items-center">
                <span aria-hidden="true">📏</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[color:var(--neu-text)] truncate">
                  Custom Size/Fits
                </h2>
                <p className="text-xs text-[color:var(--neu-text-muted)]">
                  Keep these baseline measurements current for fast custom-order checkout.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center text-[color:var(--neu-text-muted)]">
              <span className="mr-2 animate-pulse" aria-hidden="true">⏳</span>
              Loading fitting profile...
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-hide overscroll-contain">
              <details
                open
                className="rounded-2xl neu-modal-inset p-4"
              >
                <summary className="cursor-pointer font-semibold text-[color:var(--neu-text)]">
                  Baseline Measurements
                </summary>
                <p className="mt-3 text-xs text-[color:var(--neu-text-muted)]">
                  Required baseline points: {baselinePoints.length}. These are the 5-10 common measurements used to prefill most custom-order requests.
                </p>
                {missingBaselineKeys.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-200">
                    ⚠️ Missing baseline points: {missingBaselineKeys.length}. Add them now for smoother custom-order checkout.
                  </div>
                ) : null}
                <div className="mt-3 max-w-[220px]">
                  <UniversalSelect
                    label="Length Unit"
                    value={lengthUnit}
                    onChange={(value) => handleLengthUnitChange(value as 'CM' | 'IN')}
                    options={[
                      { value: 'CM', label: 'Centimeters (cm)' },
                      { value: 'IN', label: 'Inches (in)' },
                    ]}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {baselinePoints.map((point) => (
                    <label key={point.key} className="text-xs text-[color:var(--neu-text-muted)]">
                      <span className="block mb-1">{point.label}</span>
                      {point.description ? (
                        <span className="mb-1 block text-[11px] opacity-80">{point.description}</span>
                      ) : null}
                      {point.minValueCm != null || point.maxValueCm != null ? (
                        <span className="mb-1 block text-[11px] opacity-80">
                          Range: {
                            point.minValueCm == null
                              ? '-'
                              : lengthUnit === 'IN'
                                ? round(toInches(point.minValueCm))
                                : point.minValueCm
                          } to {
                            point.maxValueCm == null
                              ? '-'
                              : lengthUnit === 'IN'
                                ? round(toInches(point.maxValueCm))
                                : point.maxValueCm
                          } {lengthUnit === 'IN' ? 'in' : 'cm'}
                        </span>
                      ) : null}
                      <input
                        name={point.key}
                        value={values[point.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [point.key]: e.target.value }))
                        }
                        className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                        placeholder="Enter value"
                        autoComplete="off"
                      />
                    </label>
                  ))}
                </div>
                {baselinePoints.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-black/10 px-3 py-2 text-xs text-[color:var(--neu-text-muted)] dark:border-white/10">
                    No baseline measurement points are available for your profile yet.
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
                  <label className="text-xs text-[color:var(--neu-text-muted)]">
                    <span className="block mb-1">Fit Notes</span>
                    <textarea
                      name="fit_notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                      placeholder="Any additional details"
                    />
                  </label>
                  <label className="text-xs text-[color:var(--neu-text-muted)]">
                    <span className="block mb-1">Reminder Cycle (days)</span>
                    <input
                      name="reminder_days"
                      type="number"
                      min={14}
                      max={90}
                      value={reminderDays}
                      onChange={(e) => setReminderDays(Number(e.target.value || 14))}
                      className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveMeasurements()}
                    disabled={saving || baselinePoints.length === 0}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save Measurements'}
                  </button>
                </div>
              </details>

              <details className="rounded-2xl neu-modal-inset p-4">
                <summary className="cursor-pointer font-semibold text-[color:var(--neu-text)] flex items-center gap-2">
                  <span aria-hidden="true">🛡️</span>
                  Permissions & Visibility
                </summary>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <UniversalSelect
                    label="Visibility"
                    value={visibility}
                    onChange={(value) => setVisibility(value as 'PUBLIC' | 'PRIVATE')}
                    options={[
                      { value: 'PRIVATE', label: 'Private' },
                      { value: 'PUBLIC', label: 'Public' },
                    ]}
                  />

                  <UniversalSelect
                    label="Share Rule"
                    value={sharePolicy}
                    onChange={(value) =>
                      setSharePolicy(value as 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE')
                    }
                    options={[
                      { value: 'OWNER_ONLY', label: 'Only I can share' },
                      { value: 'REQUIRE_PERMISSION', label: 'Ask permission before sharing' },
                      { value: 'ALLOW_ANYONE', label: 'Allow re-sharing by anyone' },
                    ]}
                  />
                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-[color:var(--neu-text)]">
                  <input
                    type="checkbox"
                    checked={notifyOnShare}
                    onChange={(e) => setNotifyOnShare(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  Notify me whenever my fittings are shared.
                </label>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveSettings()}
                    disabled={saving}
                    className="rounded-xl border border-gray-300/80 dark:border-white/20 text-sm font-medium px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save Permission Settings'}
                  </button>
                </div>
              </details>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl neu-modal-inset px-4 py-2 text-sm font-medium text-[color:var(--neu-text)]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </OverlayPortal>
  );
};
