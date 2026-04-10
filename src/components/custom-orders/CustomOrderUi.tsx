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
        <div className="flex flex-wrap gap-1.5 text-left">
          {value.map((entry, index) => (
            <span
              key={`${index}-${String(entry)}`}
              className="inline-flex rounded-full border border-black/5 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
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

  const text =
    type === 'stage'
      ? stageLabelMap[value as CustomOrderProgressStage] ?? humanizeCustomOrderToken(value)
      : humanizeCustomOrderToken(value);
  const tone = statusToneMap[value] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
};

export const CustomOrderMetricCard: React.FC<{ label: string; value: React.ReactNode; helper?: React.ReactNode }> = ({
  label,
  value,
  helper,
}) => (
  <div className="group relative flex h-full min-h-[104px] min-w-0 flex-col justify-center overflow-hidden rounded-[1.4rem] border border-black/5 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/[0.05] dark:from-white/[0.03] dark:to-transparent">
    <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:animate-shimmer group-hover:opacity-100 dark:via-white/5" />
    <div className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.18em] dark:text-slate-400">{label}</div>
    <div className="relative mt-1.5 min-w-0 break-words text-lg font-bold leading-tight text-slate-900 dark:text-white">{value}</div>
    {helper ? <div className="relative mt-1 min-w-0 break-words text-[11px] font-medium text-slate-500 dark:text-slate-400">{helper}</div> : null}
  </div>
);

export const CustomOrderKeyValueList: React.FC<{ items: Array<{ label: string; value: React.ReactNode }> }> = ({ items }) => (
  <dl className="space-y-2 text-[13px] text-slate-600 dark:text-slate-300">
    {items.map((item) => (
      <div key={item.label} className="group flex items-start justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
        <dt className="min-w-0 font-medium opacity-80 transition-opacity group-hover:opacity-100">{item.label}</dt>
        <dd className="min-w-0 break-words text-right font-semibold text-slate-900 dark:text-white">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const CustomOrderJsonBreakdown: React.FC<{ data?: Record<string, unknown> | null }> = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">No breakdown available.</div>;
  }

  return (
    <div className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="group flex flex-col gap-1.5 rounded-xl border border-black/[0.06] bg-gradient-to-br from-white to-black/[0.01] px-3.5 py-3 text-sm shadow-sm transition-all duration-300 hover:border-indigo-500/30 hover:shadow-md dark:border-white/[0.06] dark:from-white/[0.02] dark:to-transparent dark:hover:border-indigo-400/30">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors sm:text-[11px] sm:tracking-[0.18em] group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300">{prettify(key)}</div>
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
  <div className="sticky top-20 z-10 overflow-x-auto rounded-[2rem] p-1 backdrop-blur-md">
    <div className="inline-flex min-w-full gap-2 rounded-[2rem] border border-white/40 bg-white/70 p-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`group relative min-w-[160px] rounded-[1.5rem] px-5 py-3.5 text-left transition-all duration-300 ${
              isActive
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {isActive && (
              <div className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 shadow-[0_8px_16px_rgba(99,102,241,0.3)] transition-all dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-500 dark:shadow-[0_8px_16px_rgba(99,102,241,0.2)]" />
            )}
            {isActive && (
              <div className="pointer-events-none absolute inset-0 -translate-x-full rounded-[1.5rem] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-1000 group-hover:animate-shimmer group-hover:opacity-100" />
            )}
            {!isActive && (
              <div className="absolute inset-0 rounded-[1.5rem] bg-black/[0.02] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-white/[0.04]" />
            )}
            
            <div className="relative z-10 flex items-center text-sm font-bold">
              <span className="mr-2 text-lg transition-transform duration-300 group-hover:scale-110" aria-hidden="true">{tab.emoji}</span>
              {tab.label}
            </div>
            {tab.helper ? (
              <div className={`relative z-10 mt-1 text-xs font-medium transition-colors duration-300 ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                {tab.helper}
              </div>
            ) : null}
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
  <div className={`group relative overflow-hidden rounded-[2rem] border border-white/40 bg-gradient-to-b from-black/[0.02] to-black/[0.05] shadow-sm dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.05] ${className ?? ''}`}>
    {src ? (
      <>
        <ImageWithFallback
          src={src}
          alt={title}
          fallbackName={title}
          fit="contain"
          rounded="none"
          containerClassName="w-full overflow-hidden"
          className="h-auto w-full max-h-[36rem] transition-transform duration-700 group-hover:scale-[1.02]"
          maxHeightClassName="max-h-[36rem]"
        />
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-black/10 dark:ring-white/10" />
      </>
    ) : (
      <div className="flex min-h-[260px] items-center justify-center bg-slate-900 text-7xl text-white transition-colors duration-500 group-hover:bg-slate-800 dark:bg-slate-950">
        <span aria-hidden="true" className="transition-transform duration-500 group-hover:scale-110">{emoji}</span>
      </div>
    )}
  </div>
);
