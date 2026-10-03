import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import WorkingHoursEditor, {
  DEFAULT_WORKING_HOURS,
  isWorkingHoursValid,
  resolveDefaultTimezone,
} from '@/components/store/WorkingHoursEditor';
import {
  getStoreStatus,
  updateWorkingHours,
  type WorkingHoursSchedule,
} from '@/api/StoreApi';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { invalidateStoreSetupStatusCache } from '@/hooks/useStoreSetupStatus';
import { invalidateRequireStoreSetupCache } from '@/components/store/RequireStoreSetup';

interface StoreHoursStepProps {
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

/**
 * Working hours — a REQUIRED setup step.
 *
 * Hours are part of the server's store-completeness check, so publishing fails
 * without them. They used to be collected nowhere in this flow, which is how a
 * brand could finish the wizard, publish, and only then be told at the
 * verification gate that its store was incomplete. There is deliberately no
 * Skip here.
 *
 * Unlike the other steps this one does not write into the wizard draft. Hours
 * have their own validated endpoint (`PATCH /store/working-hours`), so we save
 * on Continue and let the server be the record — a draft copy would just be a
 * second source of truth to keep in sync.
 */
const StoreHoursStep: React.FC<StoreHoursStepProps> = ({
  onBack,
  onContinue,
  isSaving = false,
}) => {
  const [schedule, setSchedule] = useState<WorkingHoursSchedule>(DEFAULT_WORKING_HOURS);
  const [timezone, setTimezone] = useState<string>(resolveDefaultTimezone());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed from whatever the brand already has, so re-entering the step (or
  // arriving from the settings page) shows their real schedule rather than
  // silently resetting it to the Mon–Sat default.
  useEffect(() => {
    let mounted = true;

    const seed = async () => {
      try {
        const status = await getStoreStatus();
        if (!mounted) return;
        if (status?.profile?.workingHours) {
          setSchedule(status.profile.workingHours);
        }
        if (status?.profile?.timezone) {
          setTimezone(status.profile.timezone);
        }
      } catch {
        // Defaults are a valid schedule — let the brand edit and save rather
        // than blocking the wizard on a transient status failure.
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void seed();
    return () => {
      mounted = false;
    };
  }, []);

  const valid = isWorkingHoursValid(schedule);
  const busy = isSaving || isSubmitting;

  const handleContinue = useCallback(async () => {
    if (!valid) {
      toast.error('Give every open day a valid time range, and keep at least one day open.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateWorkingHours({ workingHours: schedule, timezone });
      // Both gates read store status; a stale cache here would leave the brand
      // looking incomplete on the very next screen.
      invalidateStoreSetupStatusCache();
      invalidateRequireStoreSetupCache();
      await queryClient.invalidateQueries({ queryKey: queryKeys.store.status() });
      onContinue();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save working hours.');
    } finally {
      setIsSubmitting(false);
    }
  }, [onContinue, schedule, timezone, valid]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex-1 flex items-start justify-center p-3 sm:p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[720px]">
          <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-[color:var(--border-default)]/50 dark:border-purple-500/10 shadow-xl">
            {/* Step header, matching StorePoliciesStep. Without it this screen
                reads as a detour rather than a step of the setup flow — which
                is exactly how a required field goes unnoticed. */}
            <div className="px-8 pt-8 pb-4 border-b border-[color:var(--border-default)]/50 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold border border-purple-500/30">
                    4
                  </div>
                  <span className="text-[color:var(--text-primary)] dark:text-white font-medium">
                    Working Hours
                  </span>
                </div>
                <span className="text-xs text-[color:var(--text-secondary)] font-medium uppercase tracking-wider">
                  Step 3 of 4
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500" />
              </div>
            </div>

            <div className="origin-top scale-[0.92] space-y-5 p-4 sm:scale-100 sm:space-y-8 sm:p-8">
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold text-[color:var(--text-primary)] dark:text-white tracking-tight">
                  Your Working Hours
                </h1>
                <p className="text-[color:var(--text-secondary)] dark:text-gray-400 text-sm md:text-base">
                  Buyers see when you are open, and fulfilment timers only count
                  during these hours — so you are never measured on time your
                  store was closed.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                ⏰ Required to publish your store. You can change these any time
                from Settings → Working Hours.
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <MuseLoader size={28} />
                </div>
              ) : (
                <WorkingHoursEditor
                  value={schedule}
                  timezone={timezone}
                  disabled={busy}
                  onChange={({ workingHours, timezone: nextTimezone }) => {
                    setSchedule(workingHours);
                    setTimezone(nextTimezone);
                  }}
                />
              )}

              {!isLoading && !valid ? (
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                  Keep at least one day open, and make each closing time later
                  than its opening time.
                </p>
              ) : null}
            </div>

            <div className="flex flex-row items-center justify-end gap-2 border-t border-[color:var(--border-default)]/50 bg-[color:var(--surface-secondary)]/50 p-4 dark:border-white/5 dark:bg-black/20 sm:gap-4 sm:p-6">
              <button
                type="button"
                onClick={onBack}
                disabled={busy}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border-default)] px-3 py-2 text-xs font-medium text-[color:var(--text-primary)] transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5 sm:gap-2 sm:px-6 sm:py-2.5 sm:text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={busy || isLoading || !valid}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-8 sm:py-2.5 sm:text-sm"
              >
                {busy ? <MuseLoader size={16} /> : null}
                {busy ? 'Saving...' : 'Save & Continue'}
                {!busy ? <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreHoursStep;
