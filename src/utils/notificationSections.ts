/**
 * Time-bucketing for the notifications history list.
 *
 * The full-page list used to be one flat run of rows, which is fine for the
 * dropdown (it only ever shows the newest handful) but unreadable as history:
 * a notification from this morning and one from five weeks ago looked
 * identical apart from a "5d ago" caption nobody scans for.
 *
 * Buckets are age-based, not calendar-based — "Last 3 days" means "younger
 * than 72 hours", not "since Monday". Calendar boundaries would put a
 * notification from 11pm last night into a different section from one at 1am
 * today, which reads as a bug to anyone checking their phone in the morning.
 *
 * Pure module (no React, no date library) so the boundary behaviour can be
 * unit-tested against a fixed `now` instead of the wall clock.
 */

export type NotificationSectionKey =
  | 'highlights'
  | 'last3days'
  | 'last7days'
  | 'last30days'
  | 'older';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Exclusive upper bound on age for each bucket, oldest bound last. `older` is
 * the open-ended remainder and deliberately has no entry.
 */
export const NOTIFICATION_SECTION_MAX_AGE_MS: Record<
  Exclude<NotificationSectionKey, 'older'>,
  number
> = {
  highlights: DAY_MS,
  last3days: 3 * DAY_MS,
  last7days: 7 * DAY_MS,
  last30days: 30 * DAY_MS,
};

export const NOTIFICATION_SECTION_ORDER: readonly NotificationSectionKey[] = [
  'highlights',
  'last3days',
  'last7days',
  'last30days',
  'older',
];

export const NOTIFICATION_SECTION_LABELS: Record<NotificationSectionKey, string> = {
  highlights: 'Highlights',
  last3days: 'Last 3 days',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  older: 'Older',
};

/**
 * How many `older` rows are visible before the reader asks for more, and how
 * many each "Show more" press adds. Older history is the part you scroll past,
 * so it starts collapsed; everything newer renders in full.
 */
export const OLDER_SECTION_INITIAL_COUNT = 5;
export const OLDER_SECTION_STEP_COUNT = 10;

/**
 * Which bucket a timestamp belongs to.
 *
 * Unparseable and future-dated timestamps resolve to `highlights`. A bad clock
 * or a malformed row should surface at the top where it can be noticed, never
 * be silently buried thirty days deep.
 */
export function resolveNotificationSection(
  createdAt: string | number | Date | null | undefined,
  now: number = Date.now(),
): NotificationSectionKey {
  const timestamp =
    createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt ?? NaN).getTime();

  if (!Number.isFinite(timestamp)) return 'highlights';

  const age = now - timestamp;
  if (age < NOTIFICATION_SECTION_MAX_AGE_MS.highlights) return 'highlights';
  if (age < NOTIFICATION_SECTION_MAX_AGE_MS.last3days) return 'last3days';
  if (age < NOTIFICATION_SECTION_MAX_AGE_MS.last7days) return 'last7days';
  if (age < NOTIFICATION_SECTION_MAX_AGE_MS.last30days) return 'last30days';
  return 'older';
}

export interface NotificationSection<T> {
  key: NotificationSectionKey;
  label: string;
  items: T[];
}

/**
 * Groups newest-first notifications into the ordered, non-empty sections the
 * page renders. Input order is preserved inside each bucket, so an already
 * sorted list stays sorted and an unsorted one is not silently "fixed" — the
 * slice owns sorting.
 */
export function groupNotificationsBySection<T extends { createdAt: string }>(
  items: readonly T[],
  now: number = Date.now(),
): NotificationSection<T>[] {
  const buckets = new Map<NotificationSectionKey, T[]>();

  for (const item of items) {
    const key = resolveNotificationSection(item.createdAt, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return NOTIFICATION_SECTION_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map(
    (key) => ({
      key,
      label: NOTIFICATION_SECTION_LABELS[key],
      items: buckets.get(key) as T[],
    }),
  );
}
