import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandSubscriptionApi } from '@/api/BrandSubscriptionApi';
import { queueTierName } from './CustomOrderQueue';

export function SubscriptionHistory({ brandId }: { brandId: string }) {
  const [kind, setKind] = useState<'BILLING' | 'SUBSCRIPTIONS'>('BILLING');
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const query = useQuery({
    queryKey: [
      'brand-queue-subscription',
      brandId,
      'history',
      kind,
      cursors.at(-1),
    ],
    queryFn: () => brandSubscriptionApi.history(brandId, kind, cursors.at(-1)),
  });
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) +
        ' WAT'
      : 'Not recorded';
  return (
    <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Your history</h2>
      <div
        role="tablist"
        aria-label="Subscription history"
        className="flex flex-wrap gap-5"
      >
        {(['BILLING', 'SUBSCRIPTIONS'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={kind === value}
            className={`min-h-11 border-b-2 py-2 font-medium ${kind === value ? 'border-violet-600 text-violet-700 dark:text-violet-300' : 'border-transparent'}`}
            onClick={() => {
              setKind(value);
              setCursors([undefined]);
            }}
          >
            {value === 'BILLING' ? 'Billing history' : 'Subscription history'}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <p role="status">Loading history…</p>
      ) : query.isError ? (
        <p role="alert">
          Unable to load history.{' '}
          <button onClick={() => void query.refetch()} className="queue-button">
            Retry
          </button>
        </p>
      ) : !query.data?.items.length ? (
        <p>
          No {kind === 'BILLING' ? 'billing payments' : 'subscriptions'} yet.
        </p>
      ) : (
        query.data.items.map((item) => (
          <article
            key={item.id}
            className="space-y-1 border-b border-slate-200 py-4 dark:border-slate-800"
          >
            <p className="font-semibold">
              {queueTierName(item.tierKey || '')} · {item.status}
            </p>
            <p>
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: item.currency || 'NGN',
              }).format(item.amountNgn ?? item.lockedMonthlyPriceNgn ?? 0)}
              {kind === 'SUBSCRIPTIONS' ? ' / month' : ''}
            </p>
            <p className="text-sm">
              {date(item.periodStart ?? item.currentPeriodStart)} —{' '}
              {date(item.periodEnd ?? item.currentPeriodEnd)}
            </p>
            {item.reference ? (
              <p className="break-all text-sm">
                Receipt reference: {item.reference}
              </p>
            ) : null}
            {item.cancelAtPeriodEnd ? (
              <p className="text-sm">
                Renewal cancelled {date(item.cancelRequestedAt)}. No refund of
                the paid period.
              </p>
            ) : null}
          </article>
        ))
      )}
      <div className="flex gap-5">
        <button
          className="queue-button"
          disabled={cursors.length === 1 || query.isFetching}
          onClick={() => setCursors((values) => values.slice(0, -1))}
        >
          Previous
        </button>
        <button
          className="queue-button"
          disabled={!query.data?.nextCursor || query.isFetching}
          onClick={() =>
            setCursors((values) => [...values, query.data!.nextCursor!])
          }
        >
          Next
        </button>
      </div>
    </section>
  );
}
