import type {
  PhysicalVerificationStatus,
  PhysicalVerificationSummary,
} from '@/api/PhysicalVerificationApi';

/**
 * One surface, one border, one radius — for the whole visit feature.
 *
 * Borders were the thing that made these screens read as noise: a bordered
 * panel holding a bordered card holding a bordered row, every one a slightly
 * different grey at a slightly different radius, so the eye counted five
 * rectangles before reaching a single fact. The rule here is that a panel has
 * ONE border and everything inside it is separated by space or by a hairline
 * divider — never by another box.
 *
 * Keep using these instead of writing border classes inline. Two panels that
 * pick their own greys never line up, and the misalignment is visible even when
 * the values are one step apart.
 */

/** The only bordered box. Everything else sits inside one of these. */
export const PANEL =
  'rounded-2xl border border-black/[0.07] bg-white/80 dark:border-white/10 dark:bg-white/[0.03]';

/** A block inside a panel: no border of its own, just a soft fill. */
export const INSET = 'rounded-xl bg-black/[0.03] dark:bg-white/[0.04]';

/** Rows in a list. Hairlines only, and only between — never around. */
export const ROW_DIVIDER = 'divide-y divide-black/[0.06] dark:divide-white/[0.07]';

/** Small caps label. Used for every field name so they all match. */
export const FIELD_LABEL =
  'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400';

/**
 * Status chips share ONE shape and differ only in hue, so a status change
 * cannot resize the chip and shift the row it sits in.
 */
export const CHIP_BASE =
  'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold';

export const VISIT_STATUS_LABEL: Record<PhysicalVerificationStatus, string> = {
  PENDING_ASSIGNMENT: 'Unassigned',
  ASSIGNED: 'Assigned',
  SCHEDULE_PROPOSED: 'Awaiting brand',
  SCHEDULE_CONFIRMED: 'Scheduled',
  RESCHEDULE_REQUESTED: 'Reschedule asked',
  VISIT_COMPLETED: 'Evidence',
  ON_HOLD: 'Postponed',
  PASSED: 'Passed',
  FAILED: 'Failed',
  DECLINED: 'Declined',
};

/** Tint only — never a different size, weight or border width. */
export const VISIT_STATUS_TONE: Record<PhysicalVerificationStatus, string> = {
  PENDING_ASSIGNMENT:
    'bg-slate-500/10 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  ASSIGNED: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  SCHEDULE_PROPOSED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  SCHEDULE_CONFIRMED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  RESCHEDULE_REQUESTED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  VISIT_COMPLETED: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  ON_HOLD: 'bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  PASSED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  FAILED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  DECLINED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

/** What the brand is being asked to do, in one line. Null when nothing. */
export const brandVisitHeadline = (
  status: PhysicalVerificationStatus,
): { title: string; body: string } => {
  switch (status) {
    case 'PENDING_ASSIGNMENT':
    case 'ASSIGNED':
      return {
        title: 'A verification visit is being arranged',
        body: 'Your documents were accepted. Someone will offer you times shortly.',
      };
    case 'SCHEDULE_PROPOSED':
      return {
        title: 'Choose a time for your visit',
        body: 'Pick one of the times below, ask for a different one of them, or decline.',
      };
    case 'SCHEDULE_CONFIRMED':
      return {
        title: 'Your visit is scheduled',
        body: 'Have your workspace, packaging and branding ready to show.',
      };
    case 'RESCHEDULE_REQUESTED':
      return {
        title: 'Waiting on a reply to your new time',
        body: 'We have asked the reviewer about the time you chose.',
      };
    case 'ON_HOLD':
      return {
        title: 'Your visit is postponed',
        body: 'No date is set yet. New times will be offered here.',
      };
    case 'VISIT_COMPLETED':
      return {
        title: 'Your visit is being written up',
        body: 'The reviewer is recording what they found.',
      };
    case 'PASSED':
      return {
        title: 'Your brand is verified',
        body: 'The visit passed and your badge is active.',
      };
    case 'FAILED':
      return {
        title: 'The visit did not pass',
        body: 'You can start a new verification attempt.',
      };
    case 'DECLINED':
      return {
        title: 'The visit was declined',
        body: 'Verification did not complete. A new attempt starts from the beginning.',
      };
    default:
      return { title: 'Verification visit', body: '' };
  }
};

/** A slot, written the way a person reads an appointment. */
export const formatSlot = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Whose move it is. Drives the queue's ordering and the "needs you" filter. */
export const visitNeedsAgent = (row: PhysicalVerificationSummary): boolean =>
  row.status === 'PENDING_ASSIGNMENT' ||
  row.status === 'ASSIGNED' ||
  row.status === 'RESCHEDULE_REQUESTED' ||
  row.status === 'VISIT_COMPLETED' ||
  row.status === 'ON_HOLD';
