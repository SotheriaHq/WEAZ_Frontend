import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { describeRefund } from '@/lib/refundPresentation';
import { queueServerNow } from '@/features/orders/queueClock';
import {
  canRetainQueue,
  formatQueueCountdown,
} from '@/features/orders/customOrderQueuePresentation';
import {
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  adminOrderQueueApi,
  customOrderQueueApi,
  type QueuePresenter,
  type QueueRefundQuote,
} from '@/api/CustomOrderQueueApi';
import Modal from '@/components/ui/Modal';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { queryClient } from '@/query/queryClient';

import { useQueueTick } from './useQueueTick';
export { useQueueTick } from './useQueueTick';

export function queueRemainingMs(queue: QueuePresenter, monotonicNow: number) {
  if (!queue.queueExpiresAt) return null;
  const server = queueServerNow(queue, monotonicNow);
  const expiry = Date.parse(queue.queueExpiresAt);
  return server != null && Number.isFinite(expiry)
    ? Math.max(0, expiry - server)
    : null;
}
export const queueTierName = (key: string) =>
  (
    ({
      THREAD: 'Thread',
      ASO_OKE: 'Aso-oke',
      ARU: 'Aru',
      IGWE: 'Igwe',
    }) as Record<string, string>
  )[key] ?? key;
export const queueLaneLabels: Record<string, string> = {
  PENDING: 'Pending',
  UP_NEXT: 'Up Next',
  ACTIVE: 'Active',
  IN_DELIVERY: 'Delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NONE: 'Not queued',
};
const money = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(
    value ?? 0,
  );
export function QueueFacts({ queue }: { queue?: QueuePresenter | null }) {
  const tickNow = useQueueTick(
    queue?.lane === 'PENDING' || queue?.lane === 'UP_NEXT',
    queue,
  );
  if (!queue?.lane || queue.lane === 'NONE') return null;
  const waiting = queue.lane === 'PENDING' || queue.lane === 'UP_NEXT';
  const serverNow = queueServerNow(queue, tickNow);
  return (
    <div className="my-2 min-w-0 space-y-1 break-words text-xs text-slate-700 dark:text-slate-200">
      <div className="flex flex-wrap gap-2">
        <span className="font-semibold text-violet-800 dark:text-violet-200">
          🧵{' '}
          {queue.lane === 'TERMINAL'
            ? queue.canResubmit
              ? 'Cancelled'
              : 'Completed'
            : (queueLaneLabels[queue.lane] ?? queue.lane)}
        </span>
        {queue.position != null ? (
          <span className="py-1">
            Position {queue.position} | {queue.waitingCount} waiting
          </span>
        ) : null}
      </div>
      {waiting ? (
        <div className="border-l-2 border-amber-400 pl-3 text-amber-900 dark:border-amber-600 dark:text-amber-200">
          <span className="font-semibold">
            ⏳{' '}
            {(serverNow == null
              ? null
              : formatQueueCountdown(queue.queueExpiresAt, serverNow)) ??
              'Refreshing cancellation deadline from WIEZ'}
          </span>
          {queue.queueExpiresAt ? (
            <div>
              Cancellation deadline:{' '}
              <time dateTime={queue.queueExpiresAt}>
                {new Date(queue.queueExpiresAt).toLocaleString('en-NG', {
                  timeZone: 'Africa/Lagos',
                })}{' '}
                WAT
              </time>
            </div>
          ) : null}
        </div>
      ) : null}
      {queue.adminPromotionHeld ? (
        <p className="font-medium text-rose-700 dark:text-rose-200">
          🛑 Admin promotion hold. This order stays Pending until released. Its
          cancellation deadline and cancellation rights continue.
        </p>
      ) : null}
      {waiting ? (
        <p>
          Payment captured and held until Active. Cancellation deadlines apply
          even if a reminder is delayed.
        </p>
      ) : null}
      {waiting && queue.captureSummary ? (
        <p className="font-semibold tabular-nums">
          Captured and held:{' '}
          {money(
            queue.captureSummary.heldAmount ?? queue.captureSummary.amount,
            queue.captureSummary.currency,
          )}
        </p>
      ) : null}
      {queue.refundSummary ? (
        <p>
          {describeRefund(queue.refundSummary.status)?.title ?? 'Refund status being verified'}
          {queue.refundSummary.amount != null
            ? ` | ${money(queue.refundSummary.amount, queue.refundSummary.currency)}`
            : ''}
          . {describeRefund(queue.refundSummary.status)?.description ?? 'Refresh the order for the latest status.'}
        </p>
      ) : null}
      {queue.refundSummary?.kind === 'PARTIAL' && !queue.canResubmit ? (
        <p>
          This is a partial refund. Your order continues in its existing
          fulfilment stage.
        </p>
      ) : null}
      {(queue.refundHistory?.length ?? 0) > 1 ? (
        <details>
          <summary className="cursor-pointer py-2">Refund history</summary>
          <ul className="space-y-2">
            {queue.refundHistory!.map((refund) => (
              <li key={refund.id}>
                {refund.kind === 'PARTIAL'
                  ? 'Partial refund'
                  : 'Cancellation refund'}
                : {money(refund.amount, refund.currency)} · {describeRefund(refund.status)?.title ?? 'Status being verified'}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {queue.refundSummary?.settlement?.status === 'RECORDED' &&
      queue.refundSummary.settlement.currency !==
        queue.refundSummary.currency ? (
        <p className="tabular-nums">
          Original payment method refund:{' '}
          {money(
            queue.refundSummary.settlement.amount,
            queue.refundSummary.settlement.currency,
          )}
          , using the recorded payment rate.
        </p>
      ) : null}
    </div>
  );
}
export function QueueRefundBreakdown({ quote }: { quote: QueueRefundQuote }) {
  return (
    <dl className="space-y-2 border-y border-slate-200 py-3 text-sm dark:border-slate-800">
      {[
        ['Captured', quote.capturedAmount],
        ['Garment subtotal', quote.garmentSubtotal],
        ['VAT withheld', quote.vatWithheld],
        ['10% garment cancellation fee', quote.garmentFeeWithheld],
        ['10% jump cancellation fee', quote.jumpFeeWithheld],
        ['Delivery refunded in full', quote.deliveryRefund],
        ['Total withheld', quote.totalWithheld],
        ['Refund requested', quote.refundAmount],
      ]
        .filter(([, value]) => value != null)
        .map(([label, value]) => (
          <div
            key={String(label)}
            className="flex flex-wrap justify-between gap-2"
          >
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">
              {money(Number(value), quote.currency)}
            </dd>
          </div>
        ))}
      {quote.settlement?.status === 'RECORDED' &&
      quote.settlement.currency !== quote.currency ? (
        <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-800">
          <dt>Estimated refund to your original payment method</dt>
          <dd className="font-semibold tabular-nums">
            {money(quote.settlement.amount, quote.settlement.currency)}
          </dd>
          <dd>
            Uses the original payment rate of {quote.settlement.rate}.
            Minor-unit rounding is finalized when the refund is recorded.
          </dd>
        </div>
      ) : null}
      {quote.settlement?.status === 'REQUIRES_RECONCILIATION' ? (
        <div className="pt-2">
          <dt>Payment reconciliation required</dt>
          <dd>
            Your cancellation will be recorded. WIEZ must verify the original
            payment conversion before submitting the refund.
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
type QueueAction =
  | 'retain'
  | 'cancel'
  | 'promote'
  | 'demote'
  | 'release-hold'
  | 'resubmit';
export function QueueOrderActions({
  orderId,
  queue: initial,
  audience,
  onChanged,
  access = 'MANAGE',
}: {
  access?: 'READ' | 'MANAGE';
  orderId: string;
  queue?: QueuePresenter | null;
  audience: 'buyer' | 'brand' | 'admin';
  onChanged?: () => void | Promise<void>;
}) {
  const [updated, setUpdated] = useState<QueuePresenter | null>(null);
  const [action, setAction] = useState<QueueAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QueueRefundQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const requestRef = useRef(0);
  const identityRef = useRef(orderId);
  identityRef.current = orderId;
  const navigate = useNavigate();
  const { hasPermission } = useAdminPermissions();
  const close = useCallback(() => {
    if (!busy) {
      requestRef.current += 1;
      setAction(null);
      setReason('');
      setQuote(null);
      setQuoteError('');
    }
  }, [busy]);
  useOverlayBackClose(Boolean(action), close, true);
  useEffect(() => {
    setUpdated(null);
  }, [initial]);
  useEffect(() => {
    requestRef.current += 1;
    setAction(null);
    setQuote(null);
    setUpdated(null);
  }, [orderId]);
  const queue = updated ?? initial;
  const tickNow = useQueueTick(
    queue?.lane === 'PENDING' || queue?.lane === 'UP_NEXT',
    queue,
  );
  if (!queue?.lane || queue.lane === 'NONE') return null;
  const waiting = queue.lane === 'PENDING' || queue.lane === 'UP_NEXT';
  const canRetainNow = canRetainQueue(
    queue,
    queueServerNow(queue, tickNow) ?? NaN,
  );
  const canManage =
    access === 'MANAGE' &&
    (audience !== 'admin' || hasPermission('moderation.write'));
  const canCancel =
    access === 'MANAGE' &&
    queue.canCancel &&
    (audience !== 'admin' || hasPermission('disputes.refund'));
  async function open(next: QueueAction) {
    const sequence = ++requestRef.current;
    setAction(next);
    setReason('');
    setQuote(null);
    setQuoteError('');
    if (next === 'cancel') {
      try {
        const result = await (
          audience === 'admin' ? adminOrderQueueApi : customOrderQueueApi
        ).refundQuote(orderId);
        if (requestRef.current === sequence) setQuote(result);
      } catch (error) {
        if (requestRef.current === sequence)
          setQuoteError(
            getFriendlyErrorMessage(
              error,
              'Unable to load the current refund quote. Retry before cancelling.',
            ),
          );
      }
    }
  }
  async function submit() {
    if (!action || !queue) return;
    setBusy(true);
    try {
      if (action === 'resubmit') {
        const result = await customOrderQueueApi.resubmit(orderId);
        navigate(
          `/custom-orders/new?configurationId=${encodeURIComponent(result.configurationId)}&previousOrderId=${encodeURIComponent(orderId)}`,
        );
      } else {
        const result =
          audience === 'admin' && action !== 'retain'
            ? await adminOrderQueueApi.action(
                orderId,
                action as 'cancel' | 'promote' | 'demote' | 'release-hold',
                reason.trim(),
                quote?.orderRevision ?? queue.orderRevision,
              )
            : action === 'retain'
              ? await customOrderQueueApi.retain(orderId, queue.orderRevision)
              : await customOrderQueueApi.cancel(
                  orderId,
                  reason.trim(),
                  quote?.orderRevision ?? queue.orderRevision,
                );
        if (identityRef.current !== orderId) return;
        setUpdated(result);
        const refreshes = await Promise.allSettled([
          ...[['orders'], ['customOrders'], ['custom-order-queue-brand']].map(
            (queryKey) => queryClient.invalidateQueries({ queryKey }),
          ),
          Promise.resolve().then(() => onChanged?.()),
        ]);
        if (refreshes.some((refresh) => refresh.status === 'rejected'))
          toast.message(
            'Order updated. Refresh to load the remaining details.',
          );
      }
      toast.success(
        action === 'cancel'
          ? 'Cancellation recorded. Track refund processing on this order.'
          : action === 'retain'
            ? 'Position retained for another 42 days.'
            : 'Order updated.',
      );
      setAction(null);
      setReason('');
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          'The order changed or the request failed. Refresh and try again.',
        ),
      );
      void Promise.resolve()
        .then(() => onChanged?.())
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      {updated ? <QueueFacts queue={updated} /> : null}
      <div className="flex flex-wrap gap-2">
        {audience === 'buyer' && canRetainNow ? (
          <button className="queue-button" onClick={() => void open('retain')}>
            📌 Retain position
          </button>
        ) : null}
        {canCancel ? (
          <button
            className="queue-button text-rose-700 dark:text-rose-200"
            onClick={() => void open('cancel')}
          >
            Cancel waiting order
          </button>
        ) : null}
        {audience === 'admin' && canManage && waiting ? (
          <>
            {queue.adminPromotionHeld ? (
              <button
                className="queue-button"
                onClick={() => void open('release-hold')}
              >
                Release promotion hold
              </button>
            ) : (
              <button
                className="queue-button"
                onClick={() =>
                  void open(queue.lane === 'UP_NEXT' ? 'demote' : 'promote')
                }
              >
                {queue.lane === 'UP_NEXT'
                  ? 'Demote to Pending'
                  : 'Promote to Up Next'}
              </button>
            )}
          </>
        ) : null}
        {audience === 'buyer' && queue.canResubmit ? (
          <button
            className="queue-button"
            onClick={() => void open('resubmit')}
          >
            Resubmit with current quote
          </button>
        ) : null}
      </div>
      {audience === 'buyer' && waiting && !canRetainNow ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          One retain is available from 48 hours through exactly 12 hours before
          cancellation, if unused.
        </p>
      ) : null}
      <Modal
        open={Boolean(action)}
        onClose={close}
        title={
          action === 'cancel'
            ? 'Review cancellation and refund'
            : action === 'demote'
              ? 'Demote and hold promotion'
              : action === 'retain'
                ? 'Retain this position'
                : action === 'resubmit'
                  ? 'Place a separate new order'
                  : 'Confirm queue change'
        }
        size="sm"
      >
        <div className="space-y-4 text-sm text-slate-800 dark:text-slate-100">
          {action === 'cancel' ? (
            <>
              <p>
                Every cancellation before Active withholds the snapshotted VAT,
                10% of garment subtotal and 10% of any jump fee. Delivery is
                refunded in full. The refund is processed separately.
              </p>
              {quote ? (
                <QueueRefundBreakdown quote={quote} />
              ) : (
                <p role="status">
                  {quoteError || 'Loading the server refund quote…'}
                </p>
              )}
              {quoteError ? (
                <button
                  className="queue-button"
                  onClick={() => void open('cancel')}
                >
                  Retry quote
                </button>
              ) : null}
            </>
          ) : null}
          {action === 'retain' ? (
            <p>
              This one-time retain adds 42 days to the existing cancellation
              deadline and preserves your position. It does not start from
              today.
            </p>
          ) : null}
          {action === 'demote' ? (
            <p>
              The order returns to Pending with a durable admin promotion hold,
              including when it is the only waiting order. Release the hold
              explicitly when it may progress. Cancellation and the expiry
              countdown continue.
            </p>
          ) : null}
          {action === 'promote' ? (
            <p>
              The server checks capacity, the current Up Next order and queue
              eligibility before applying this change.
            </p>
          ) : null}
          {action === 'release-hold' ? (
            <p>
              Release this order for normal queue progression. The existing
              cancellation deadline is preserved.
            </p>
          ) : null}
          {action === 'resubmit' ? (
            <p>
              A new order requires a new payment, current prices, available
              intake and validated measurements. Any previous refund continues
              separately and cannot fund this payment.
            </p>
          ) : null}
          {action && !['retain', 'resubmit'].includes(action) ? (
            <label className="block">
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button disabled={busy} className="queue-button" onClick={close}>
              Go back
            </button>
            <button
              disabled={
                busy ||
                (action === 'cancel' && !quote) ||
                (!!action &&
                  !['retain', 'resubmit'].includes(action) &&
                  reason.trim().length < 3)
              }
              className="queue-button bg-violet-700 text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? 'Processing…' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export function QueueBrandCounts({ brandId }: { brandId: string }) {
  const query = useQuery({
    queryKey: ['custom-order-queue-brand', brandId],
    queryFn: () => customOrderQueueApi.brand(brandId),
    staleTime: 15000,
  });
  if (query.isPending)
    return (
      <p role="status" className="text-sm">
        Loading current queue capacity…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert">
        Queue capacity unavailable.{' '}
        <button className="queue-button" onClick={() => void query.refetch()}>
          Retry
        </button>
      </div>
    );
  const summary = query.data;
  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-slate-50/90 p-4 shadow-sm dark:border-white/10 dark:bg-[#120a1f] sm:p-5 text-slate-900 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
        <div className="inline-flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/15 text-sm dark:bg-violet-400/20">
            🧵
          </span>
          <h2 className="text-sm sm:text-base font-bold tracking-tight">
            {summary.capacity.tierKey
              ? `${queueTierName(summary.capacity.tierKey)} Queue`
              : 'Custom-Order Queue'}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            summary.intakeAllowed
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {!summary.intakeAllowed ? 'New intake paused' : 'Accepting new orders'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Object.entries(summary.counts).map(([lane, count]) => {
          const denominator =
            lane === 'ACTIVE' && summary.capacity.active !== undefined
              ? ` / ${summary.capacity.active ?? 'Unlimited'}`
              : lane === 'IN_DELIVERY' && summary.capacity.inDelivery !== undefined
                ? ` / ${summary.capacity.inDelivery ?? 'Unlimited'}`
                : lane === 'UP_NEXT'
                  ? ' / 1'
                  : '';
          return (
            <div
              key={lane}
              className="rounded-xl bg-white/80 p-3 shadow-xs dark:bg-white/[0.04] dark:border dark:border-white/5"
            >
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white sm:text-2xl">
                  {count}
                </span>
                {denominator ? (
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {denominator}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {queueLaneLabels[lane]}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
