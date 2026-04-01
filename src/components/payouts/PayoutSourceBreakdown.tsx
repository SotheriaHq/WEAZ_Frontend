import React from 'react';
import type { PayoutSourceBreakdown as PayoutSourceBreakdownData } from '@/types/payouts';

interface PayoutSourceBreakdownProps {
  breakdown?: PayoutSourceBreakdownData | null;
  title?: string;
  emptyMessage?: string;
}

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
};

const sourceTone = (sourceType?: string | null) => {
  const normalized = String(sourceType || '').trim().toUpperCase();
  if (normalized === 'CUSTOM_ORDER') {
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-500/20';
  }
  return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/20';
};

const metricCardClassName =
  'rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20';

const PayoutSourceBreakdown: React.FC<PayoutSourceBreakdownProps> = ({
  breakdown,
  title = 'Payout source breakdown',
  emptyMessage = 'No payout source allocations were recorded for this payout.',
}) => {
  const items = breakdown?.items ?? [];

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Reserved payout sources across released standard-order credits and custom-order releases.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-black/20 dark:text-gray-200">
          {breakdown?.itemCount ?? 0} source{(breakdown?.itemCount ?? 0) === 1 ? '' : 's'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className={metricCardClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Payout amount
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            {formatMoney(breakdown?.payoutAmount ?? 0, items[0]?.currency || 'NGN')}
          </div>
        </div>
        <div className={metricCardClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Attributed
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            {formatMoney(breakdown?.attributedAmount ?? 0, items[0]?.currency || 'NGN')}
          </div>
        </div>
        <div className={metricCardClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Standard orders
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            {breakdown?.standardOrderCount ?? 0}
          </div>
        </div>
        <div className={metricCardClassName}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Custom orders
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            {breakdown?.customOrderCount ?? 0}
          </div>
        </div>
      </div>

      {(breakdown?.unattributedAmount ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {formatMoney(
            breakdown?.unattributedAmount ?? 0,
            items[0]?.currency || 'NGN',
          )}{' '}
          is not linked to a first-class payout source row yet. Treat this payout as partially legacy-backed.
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sourceTone(item.sourceType)}`}
                    >
                      {item.sourceType === 'CUSTOM_ORDER' ? 'Custom order' : 'Standard order'}
                    </span>
                    {item.releaseStage ? (
                      <span className="inline-flex rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-white/10 dark:text-gray-300">
                        {item.releaseStage}
                      </span>
                    ) : null}
                    {item.referenceCode ? (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                        {item.referenceCode}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {item.label}
                  </h4>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.counterparty || 'Counterparty unavailable'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    Reserved
                  </div>
                  <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                    {formatMoney(item.reservedAmount, item.currency)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SourceMetric
                  label="Credited"
                  value={
                    item.creditedAmount != null
                      ? formatMoney(item.creditedAmount, item.currency)
                      : 'Not available'
                  }
                />
                <SourceMetric
                  label="Gross"
                  value={
                    item.grossAmount != null
                      ? formatMoney(item.grossAmount, item.currency)
                      : 'Not available'
                  }
                />
                <SourceMetric
                  label="Commission"
                  value={
                    item.commissionAmount != null
                      ? formatMoney(item.commissionAmount, item.currency)
                      : 'Not available'
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
                <div>
                  <div className="uppercase tracking-[0.16em]">Released</div>
                  <div className="mt-1">{formatDate(item.sourceCreatedAt)}</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.16em]">Linked to payout</div>
                  <div className="mt-1">{formatDate(item.linkedAt)}</div>
                </div>
              </div>

              {item.note ? (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  {item.note}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const SourceMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
  </div>
);

export default PayoutSourceBreakdown;
