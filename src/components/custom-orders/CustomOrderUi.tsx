import React from 'react';
import type {
  CustomOrderProgressStage,
} from '@/api/CustomOrderApi';

const stageLabelMap: Record<CustomOrderProgressStage, string> = {
  ORDER_PLACED: '🧾 Order Placed',
  ORDER_RECEIVED: '🪡 Order Received',
  FABRIC_AND_PIECE_PURCHASE_GATHERING: '🧵 Fabric & Piece Gathering',
  DESIGN_MODE: '✂️ Design Mode',
  FINAL_TOUCHES_AND_PACKAGING: '📦 Final Touches & Packaging',
  READY_FOR_DELIVERY: '🚚 Ready For Delivery',
};

const statusToneMap: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
  PENDING_BRAND_ACCEPTANCE: 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-200',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  IN_PRODUCTION: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  READY_FOR_DISPATCH: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200',
  DELIVERED_PENDING_BUYER_CONFIRMATION: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  REJECTED_BY_BRAND: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  CANCELLED_BY_BUYER_PRE_ACCEPTANCE: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
  DELIVERY_ISSUE_REPORTED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  REFUND_IN_PROGRESS: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200',
  DISPUTED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200',
  CLOSED: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  PROCESSING: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  REFUNDED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
};

const prettify = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export const getRelativeDeadlineText = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 'Not scheduled';
  const diffMs = target.getTime() - Date.now();
  const absHours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));
  if (absHours < 1) {
    return diffMs >= 0 ? 'Due in under 1 hour' : 'Late by under 1 hour';
  }
  if (absHours < 48) {
    return diffMs >= 0 ? `Due in ${absHours}h` : `Late by ${absHours}h`;
  }
  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `Due in ${absDays} day${absDays === 1 ? '' : 's'}` : `Late by ${absDays} day${absDays === 1 ? '' : 's'}`;
};

export const CustomOrderBadge: React.FC<{
  value?: string | null;
  type?: 'status' | 'payment' | 'stage';
}> = ({ value, type = 'status' }) => {
  if (!value) {
    return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">—</span>;
  }

  const text = type === 'stage' ? stageLabelMap[value as CustomOrderProgressStage] ?? prettify(value) : prettify(value);
  const tone = statusToneMap[value] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200';

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
};

export const CustomOrderMetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}> = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value}</div>
    {helper ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</div> : null}
  </div>
);

export const CustomOrderKeyValueList: React.FC<{
  items: Array<{ label: string; value: React.ReactNode }>;
}> = ({ items }) => (
  <dl className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
    {items.map((item) => (
      <div key={item.label} className="flex items-start justify-between gap-4">
        <dt>{item.label}</dt>
        <dd className="text-right font-medium text-slate-900 dark:text-white">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const CustomOrderJsonBreakdown: React.FC<{
  data?: Record<string, unknown> | null;
}> = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">No breakdown available.</div>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          <div className="text-slate-500 dark:text-slate-400">{prettify(key)}</div>
          <div className="text-right font-medium text-slate-900 dark:text-white break-all">
            {typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
              ? String(value)
              : JSON.stringify(value)}
          </div>
        </div>
      ))}
    </div>
  );
};
