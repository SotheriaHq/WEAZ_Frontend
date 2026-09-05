import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import WorkingHoursEditor, {
  DEFAULT_WORKING_HOURS,
  isWorkingHoursValid,
  resolveDefaultTimezone,
} from '@/components/store/WorkingHoursEditor';
import { updateWorkingHours, type WorkingHoursSchedule } from '@/api/StoreApi';
import { useStoreStatusQuery } from '@/query/queries';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { invalidateStoreSetupStatusCache } from '@/hooks/useStoreSetupStatus';
import { invalidateRequireStoreSetupCache } from '@/components/store/RequireStoreSetup';

const StoreHoursSettings: React.FC = () => {
  const statusQuery = useStoreStatusQuery();
  const status = statusQuery.data;

  const [schedule, setSchedule] = useState<WorkingHoursSchedule>(DEFAULT_WORKING_HOURS);
  const [timezone, setTimezone] = useState<string>(resolveDefaultTimezone());
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed once from the server's saved hours (or sensible defaults).
  useEffect(() => {
    if (seeded || !status) return;
    if (status.profile?.workingHours) {
      setSchedule(status.profile.workingHours);
    }
    if (status.profile?.timezone) {
      setTimezone(status.profile.timezone);
    }
    setSeeded(true);
  }, [seeded, status]);

  const valid = useMemo(() => isWorkingHoursValid(schedule), [schedule]);
  const required = Boolean(status?.workingHoursRequired);
  const configured = Boolean(status?.businessHoursConfigured);

  const handleSave = async () => {
    if (!valid) {
      toast.error('Please give every open day a valid time range (close after open).');
      return;
    }
    setSaving(true);
    try {
      await updateWorkingHours({ workingHours: schedule, timezone });
      invalidateStoreSetupStatusCache();
      invalidateRequireStoreSetupCache();
      await queryClient.invalidateQueries({ queryKey: queryKeys.store.status() });
      toast.success('Working hours saved.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save working hours.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Working hours</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Set the days and hours your store operates. Order fulfilment timers only
          count during these hours, so you are measured fairly.
        </p>
        {required && !configured ? (
          <div className="mt-3 rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Working hours are required to operate your store. Set them below to
            continue.
          </div>
        ) : null}
      </div>

      <WorkingHoursEditor
        value={schedule}
        timezone={timezone}
        onChange={({ workingHours, timezone: tz }) => {
          setSchedule(workingHours);
          setTimezone(tz);
        }}
        disabled={saving}
      />

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} loading={saving} disabled={saving || !valid}>
          Save working hours
        </Button>
      </div>
    </div>
  );
};

export default StoreHoursSettings;
