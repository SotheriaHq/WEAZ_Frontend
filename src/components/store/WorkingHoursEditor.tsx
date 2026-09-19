import React, { useMemo } from 'react';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type {
  DaySchedule,
  WeekdayKey,
  WorkingHoursSchedule,
} from '@/api/StoreApi';

const DAYS: Array<{ key: WeekdayKey; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const openDay = (): DaySchedule => ({ open: '09:00', close: '18:00', closed: false });
const closedDay = (): DaySchedule => ({ open: '09:00', close: '18:00', closed: true });

/** Sensible starting point: Mon–Sat open 09:00–18:00, Sunday closed. */
export const DEFAULT_WORKING_HOURS: WorkingHoursSchedule = {
  monday: openDay(),
  tuesday: openDay(),
  wednesday: openDay(),
  thursday: openDay(),
  friday: openDay(),
  saturday: openDay(),
  sunday: closedDay(),
};

export function resolveDefaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'Africa/Lagos';
  } catch {
    return 'Africa/Lagos';
  }
}

const CURATED_TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Nairobi',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Casablanca',
  'Europe/London',
  'America/New_York',
];

function timezoneOptions(current: string) {
  let all: string[] = CURATED_TIMEZONES;
  try {
    const supported = (Intl as any).supportedValuesOf?.('timeZone') as
      | string[]
      | undefined;
    if (Array.isArray(supported) && supported.length > 0) all = supported;
  } catch {
    /* fall back to curated */
  }
  const set = new Set(all);
  if (current) set.add(current);
  return Array.from(set).map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));
}

/** True when every open day has close strictly after open. */
export function isWorkingHoursValid(schedule: WorkingHoursSchedule): boolean {
  let openCount = 0;
  for (const { key } of DAYS) {
    const day = schedule[key];
    if (!day || day.closed) continue;
    openCount += 1;
    if (!day.open || !day.close || day.close <= day.open) return false;
  }
  return openCount > 0;
}

interface WorkingHoursEditorProps {
  value: WorkingHoursSchedule;
  timezone: string;
  onChange: (next: { workingHours: WorkingHoursSchedule; timezone: string }) => void;
  disabled?: boolean;
}

const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({
  value,
  timezone,
  onChange,
  disabled,
}) => {
  const tzOptions = useMemo(() => timezoneOptions(timezone), [timezone]);

  const setDay = (key: WeekdayKey, patch: Partial<DaySchedule>) => {
    const current = value[key] ?? openDay();
    onChange({
      workingHours: { ...value, [key]: { ...current, ...patch } },
      timezone,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Timezone
        </label>
        <UniversalSelect
          value={timezone}
          onChange={(tz) => onChange({ workingHours: value, timezone: tz })}
          options={tzOptions}
          searchable
          disabled={disabled}
          placeholder="Select your timezone"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Fulfilment timers only count during your open hours in this timezone.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = value[key] ?? openDay();
          const invalid = !day.closed && (!day.open || !day.close || day.close <= day.open);
          return (
            <div
              key={key}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <span className="w-24 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {label}
              </span>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!day.closed}
                  disabled={disabled}
                  onChange={(e) => setDay(key, { closed: !e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30"
                />
                Open
              </label>
              {!day.closed ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.open}
                    disabled={disabled}
                    onChange={(e) => setDay(key, { open: e.target.value })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-white/5"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    value={day.close}
                    disabled={disabled}
                    onChange={(e) => setDay(key, { close: e.target.value })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-white/5"
                  />
                  {invalid ? (
                    <span className="text-xs text-red-500">Close must be after open</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-slate-400 dark:text-slate-500">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkingHoursEditor;
