import React from 'react';
import type { CustomOrderProgressStage } from '@/api/CustomOrderApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import { humanizeCustomOrderToken } from './customOrderFormatting';

const stageLabelMap: Record<CustomOrderProgressStage, string> = {
  ORDER_PLACED: '🧾 Order Placed',
  ORDER_RECEIVED: '🪡 Order Received',
  FABRIC_AND_PIECE_PURCHASE_GATHERING: '🧵 Fabric & Piece Gathering',
  DESIGN_MODE: '✂️ Design Mode',
  FINAL_TOUCHES_AND_PACKAGING: '📦 Final Touches & Packaging',
  READY_FOR_DELIVERY: '🚚 Ready For Delivery',
};

const statusToneMap: Record<string, string> = {
  DRAFT: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
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
  ORDER_PLACED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  ORDER_RECEIVED: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  FABRIC_AND_PIECE_PURCHASE_GATHERING: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200',
  DESIGN_MODE: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
  FINAL_TOUCHES_AND_PACKAGING: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-200',
  READY_FOR_DELIVERY: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
};

const prettify = (value: string) =>
  String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatPrimitiveValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return '—';

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime()) && /[-/:TZ]/.test(trimmed)) {
      return parsedDate.toLocaleString();
    }

    if (/^[A-Z0-9_]+$/.test(trimmed) && trimmed.includes('_')) {
      return humanizeCustomOrderToken(trimmed);
    }

    return trimmed;
  }

  return JSON.stringify(value);
};

const renderBreakdownValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return <span className="whitespace-pre-wrap break-words">{formatPrimitiveValue(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>—</span>;

    const primitiveValues = value.every(
      (entry) =>
        entry === null ||
        entry === undefined ||
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean',
    );

    if (primitiveValues) {
      return (
        <div className="flex flex-wrap gap-2 text-left">
          {value.map((entry, index) => (
            <span
              key={`${index}-${String(entry)}`}
              className="inline-flex rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
            >
              {formatPrimitiveValue(entry)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-2 text-left md:grid-cols-2">
        {value.slice(0, 4).map((entry, index) => (
          <div key={`${index}-${String(entry)}`} className="rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]">
            {renderBreakdownValue(entry)}
          </div>
        ))}
        {value.length > 4 ? (
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            +{value.length - 4} more item{value.length - 4 === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>
    );
  }

  const objectEntries = Object.entries(value as Record<string, unknown>);
  if (objectEntries.length === 0) return <span>—</span>;

  return (
    <div className="grid gap-2 text-left md:grid-cols-2 xl:grid-cols-3">
      {objectEntries.slice(0, 5).map(([key, entryValue]) => (
        <div key={key} className="grid gap-1 rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {prettify(key)}
          </div>
          <div className="font-medium text-slate-900 dark:text-white">
            {formatPrimitiveValue(entryValue)}
          </div>
        </div>
      ))}
      {objectEntries.length > 5 ? (
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          +{objectEntries.length - 5} more field{objectEntries.length - 5 === 1 ? '' : 's'}
        </div>
      ) : null}
    </div>
  );
};

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
  if (absHours < 1) return diffMs >= 0 ? 'Due in under 1 hour' : 'Late by under 1 hour';
  if (absHours < 48) return diffMs >= 0 ? `Due in ${absHours}h` : `Late by ${absHours}h`;
  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `Due in ${absDays} day${absDays === 1 ? '' : 's'}` : `Late by ${absDays} day${absDays === 1 ? '' : 's'}`;
};

export const CustomOrderBadge: React.FC<{ value?: string | null; type?: 'status' | 'payment' | 'stage' }> = ({
  value,
  type = 'status',
}) => {
  if (!value) {
    return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">—</span>;
  }

  const text = type === 'stage' ? stageLabelMap[value as CustomOrderProgressStage] ?? prettify(value) : prettify(value);
  const tone = statusToneMap[value] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
};

export const CustomOrderMetricCard: React.FC<{ label: string; value: React.ReactNode; helper?: React.ReactNode }> = ({
  label,
  value,
  helper,
}) => (
  <div className="h-full min-h-[104px] min-w-0 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-2 min-w-0 break-words text-lg font-semibold leading-tight text-slate-900 dark:text-white">{value}</div>
    {helper ? <div className="mt-1 min-w-0 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{helper}</div> : null}
  </div>
);

export const CustomOrderKeyValueList: React.FC<{ items: Array<{ label: string; value: React.ReactNode }> }> = ({ items }) => (
  <dl className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
    {items.map((item) => (
      <div key={item.label} className="flex items-start justify-between gap-4">
        <dt className="min-w-0">{item.label}</dt>
        <dd className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const CustomOrderJsonBreakdown: React.FC<{ data?: Record<string, unknown> | null }> = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">No breakdown available.</div>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{prettify(key)}</div>
          <div className="font-medium text-slate-900 dark:text-white">{renderBreakdownValue(value)}</div>
        </div>
      ))}
    </div>
  );
};

export const CustomOrderDataTable: React.FC<{
  title?: string;
  rows: Array<{ label: string; value: React.ReactNode }>;
}> = ({ title, rows }) => {
  if (!rows.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">No data available.</div>;
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
      {title ? (
        <div className="border-b border-black/10 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-white/10 dark:text-white">
          {title}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-black/10 first:border-t-0 dark:border-white/10">
                <th className="w-56 px-4 py-3 text-left align-top text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {row.label}
                </th>
                <td className="px-4 py-3 align-top text-sm font-medium text-slate-900 dark:text-white">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const CustomOrderStageProgress: React.FC<{
  stages: Array<{ value: CustomOrderProgressStage; label: string }>;
  currentStage?: CustomOrderProgressStage | null;
  lockedStages?: CustomOrderProgressStage[];
}> = ({ stages, currentStage, lockedStages = [] }) => {
  const activeIndex = stages.findIndex((stage) => stage.value === currentStage);
  const lockedStageSet = new Set(lockedStages);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage, index) => {
        const isActive = currentStage === stage.value;
        const isComplete = activeIndex >= 0 && index < activeIndex;
        const isLocked = lockedStageSet.has(stage.value) && !isActive && !isComplete;
        const emoji = isComplete ? '✅' : isActive ? '🟣' : isLocked ? '🔒' : '⚪';
        const tone = isActive
          ? 'border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100'
          : isComplete
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
            : 'border-black/10 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';

        return (
          <div key={stage.value} className={`rounded-2xl border px-3 py-3 ${tone}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{stage.label}</div>
                <div className="mt-1 text-xs opacity-80">
                  {isActive
                    ? 'Current stage'
                    : isComplete
                      ? 'Completed'
                      : isLocked
                        ? 'Unlocks later'
                        : 'Upcoming'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const CustomOrderWorkspaceTabs: React.FC<{
  tabs: Array<{ id: string; label: string; emoji: string; helper?: string }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="sticky top-20 z-10 overflow-x-auto rounded-[1.75rem] backdrop-blur">
    <div className="inline-flex min-w-full gap-2 rounded-[1.75rem] border border-black/10 bg-white/85 p-2 dark:border-white/10 dark:bg-white/[0.05]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`min-w-[150px] rounded-[1.2rem] px-4 py-3 text-left transition ${
              isActive
                ? 'bg-gray-900 font-bold text-white shadow-[0_18px_50px_rgba(15,23,42,0.24)] dark:bg-white dark:text-slate-950'
                : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="text-sm font-semibold">
              <span className="mr-2" aria-hidden="true">{tab.emoji}</span>
              {tab.label}
            </div>
            {tab.helper ? <div className={`mt-1 text-xs ${isActive ? 'text-white/80 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>{tab.helper}</div> : null}
          </button>
        );
      })}
    </div>
  </div>
);

export const CustomOrderMediaPreview: React.FC<{ src?: string | null; title: string; emoji?: string; className?: string }> = ({
  src,
  title,
  emoji = '🧵',
  className,
}) => (
  <div className={`overflow-hidden rounded-[1.75rem] border border-black/10 dark:border-white/10 ${className ?? ''}`}>
    {src ? (
      <ImageWithFallback
        src={src}
        alt={title}
        fallbackName={title}
        fit="contain"
        rounded="none"
        containerClassName="w-full overflow-hidden"
        className="h-auto w-full max-h-[36rem]"
        maxHeightClassName="max-h-[36rem]"
      />
    ) : (
      <div className="flex min-h-[260px] items-center justify-center bg-slate-950 text-7xl text-white">
        <span aria-hidden="true">{emoji}</span>
      </div>
    )}
  </div>
);
