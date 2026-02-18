import React, { useEffect, useState } from 'react';
import { Loader2, Ruler, ShieldCheck, X } from 'lucide-react';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import type { SizeFitProfile } from '@/types/sizeFit';

const MEASUREMENT_FIELDS = [
  { key: 'heightCm', label: 'Height (cm)' },
  { key: 'weightKg', label: 'Weight (kg)' },
  { key: 'chestCm', label: 'Chest (cm)' },
  { key: 'bustCm', label: 'Bust (cm)' },
  { key: 'waistCm', label: 'Waist (cm)' },
  { key: 'hipsCm', label: 'Hips (cm)' },
  { key: 'shoulderCm', label: 'Shoulder (cm)' },
  { key: 'inseamCm', label: 'Inseam (cm)' },
  { key: 'sleeveCm', label: 'Sleeve (cm)' },
  { key: 'shoeSizeEu', label: 'Shoe (EU)' },
] as const;

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
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [reminderDays, setReminderDays] = useState(14);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [sharePolicy, setSharePolicy] = useState<
    'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE'
  >('REQUIRE_PERMISSION');
  const [notifyOnShare, setNotifyOnShare] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const nextValues: Record<string, string> = {};
    for (const field of MEASUREMENT_FIELDS) {
      const raw = profile.measurements?.[field.key];
      nextValues[field.key] =
        typeof raw === 'number' || typeof raw === 'string' ? String(raw) : '';
    }
    setValues(nextValues);
    setNotes(profile.notes ?? '');
    setReminderDays(profile.requireUpdateEveryDays ?? 14);
    setVisibility(profile.visibility);
    setSharePolicy(profile.sharePolicy);
    setNotifyOnShare(profile.notifyOnShare);
  }, [profile]);

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
    for (const [key, value] of Object.entries(values)) {
      if (!value.trim()) continue;
      const parsed = Number(value);
      measurements[key] = Number.isFinite(parsed) ? parsed : value.trim();
    }
    await onSaveMeasurements({
      measurements,
      notes,
      requireUpdateEveryDays: reminderDays,
    });
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

        <section className="relative z-10 w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95 border border-white/40 dark:border-white/10 shadow-2xl">
          <header className="sticky top-0 z-10 p-5 border-b border-gray-200/70 dark:border-white/10 bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white grid place-items-center">
                <Ruler className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Custom Size/Fits
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Keep these measurements current every two weeks for accurate orders.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </button>
          </header>

          {loading ? (
            <div className="p-10 flex items-center justify-center text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading fitting profile...
            </div>
          ) : (
            <div className="p-5 space-y-4 max-h-[calc(100vh-11rem)] overflow-y-auto scrollbar-hide overscroll-contain">
              <details
                open
                className="rounded-2xl border border-gray-200/70 dark:border-white/10 p-4 bg-white/60 dark:bg-white/5"
              >
                <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">
                  Measurements
                </summary>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MEASUREMENT_FIELDS.map((field) => (
                    <label key={field.key} className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="block mb-1">{field.label}</span>
                      <input
                        name={field.key}
                        value={values[field.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white"
                        placeholder="Enter value"
                        autoComplete="off"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                  <label className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="block mb-1">Fit Notes</span>
                    <textarea
                      name="fit_notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      placeholder="Any additional details"
                    />
                  </label>
                  <label className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="block mb-1">Reminder Cycle (days)</span>
                    <input
                      name="reminder_days"
                      type="number"
                      min={7}
                      max={60}
                      value={reminderDays}
                      onChange={(e) => setReminderDays(Number(e.target.value || 14))}
                      className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveMeasurements()}
                    disabled={saving}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Measurements'}
                  </button>
                </div>
              </details>

              <details className="rounded-2xl border border-gray-200/70 dark:border-white/10 p-4 bg-white/60 dark:bg-white/5">
                <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Permissions & Visibility
                </summary>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
                    {saving ? 'Saving...' : 'Save Permission Settings'}
                  </button>
                </div>
              </details>
            </div>
          )}

          <footer className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex justify-end bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300/80 dark:border-white/20 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Close
            </button>
          </footer>
        </section>
      </div>
    </OverlayPortal>
  );
};
