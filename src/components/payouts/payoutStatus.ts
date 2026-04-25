export interface PayoutStatusMeta {
  emoji: string;
  label: string;
  tone: string;
}

const PAYOUT_STATUS_COPY: Record<string, PayoutStatusMeta> = {
  PENDING_APPROVAL: {
    emoji: '🕒',
    label: 'Pending approval',
    tone: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30',
  },
  APPROVED: {
    emoji: '🟡',
    label: 'Processing',
    tone: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  },
  PROCESSING: {
    emoji: '🟡',
    label: 'Processing',
    tone: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  },
  PAID: {
    emoji: '✅',
    label: 'Paid',
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  },
  FAILED: {
    emoji: '⛔',
    label: 'Failed',
    tone: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
  },
  REJECTED: {
    emoji: '⛔',
    label: 'Failed',
    tone: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
  },
  ON_HOLD: {
    emoji: '⏸️',
    label: 'On hold',
    tone: 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-200 dark:bg-white/5 dark:border-white/10',
  },
  RECONCILIATION_REVIEW: {
    emoji: '🧾',
    label: 'Reconciliation review',
    tone: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-200 dark:bg-white/5 dark:border-white/10',
  },
};

export function getPayoutStatusMeta(status?: string | null): PayoutStatusMeta {
  const normalized = String(status || '').trim().toUpperCase();
  return PAYOUT_STATUS_COPY[normalized] ?? {
    emoji: '🧾',
    label: normalized || 'Unknown',
    tone: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-200 dark:bg-white/5 dark:border-white/10',
  };
}