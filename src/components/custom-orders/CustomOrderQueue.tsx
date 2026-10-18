import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { queueServerNow } from '@/features/orders/queueClock';
import { canRetainQueue, formatQueueCountdown } from '@/features/orders/customOrderQueuePresentation';
import { useCallback, useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { adminOrderQueueApi, customOrderQueueApi, type QueuePresenter, type QueueRefundQuote } from '@/api/CustomOrderQueueApi';
import Modal from '@/components/ui/Modal';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { queryClient } from '@/query/queryClient';

const listeners = new Set<() => void>();
let clock = performance.now();
let timer: ReturnType<typeof setInterval> | undefined;
function tick() { clock = performance.now(); listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) { tick(); timer = setInterval(tick, 1000); document.addEventListener('visibilitychange', tick); window.addEventListener('online', tick); }
  return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined; document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); } };
}
const subscribeIdle = () => () => undefined;
export function useQueueTick(active = true) {
  return useSyncExternalStore(active ? subscribe : subscribeIdle, () => clock, () => 0);
}
export function queueRemainingMs(queue: QueuePresenter, monotonicNow: number) {
  if (!queue.queueExpiresAt) return null;
  const server = queueServerNow(queue, monotonicNow);
  const expiry = Date.parse(queue.queueExpiresAt);
  return server != null && Number.isFinite(expiry) ? Math.max(0, expiry - server) : null;
}
export const queueTierName = (key: string) => ({ THREAD: 'Thread', ASO_OKE: 'Aso-oke', ARU: 'Aru', IGWE: 'Igwe', LEGACY: 'Legacy' } as Record<string, string>)[key] ?? key;
export const queueLaneLabels: Record<string, string> = { PENDING: 'Pending', UP_NEXT: 'Up Next', ACTIVE: 'Active', IN_DELIVERY: 'Delivery', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NONE: 'Not queued' };
const money = (value: number | undefined, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value ?? 0);
export function QueueFacts({ queue }: { queue?: QueuePresenter | null }) {
  const tickNow = useQueueTick(queue?.lane === 'PENDING' || queue?.lane === 'UP_NEXT');
  if (!queue?.lane || queue.lane === 'NONE') return null;
  const waiting = queue.lane === 'PENDING' || queue.lane === 'UP_NEXT';
  const serverNow = queueServerNow(queue, tickNow);
  return <div className="my-2 min-w-0 space-y-1 break-words text-xs text-slate-700 dark:text-slate-200">
    <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-violet-100 px-2 py-1 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">🧵 {queue.lane === 'TERMINAL' ? queue.canResubmit ? 'Cancelled' : 'Completed' : queueLaneLabels[queue.lane] ?? queue.lane}</span>{queue.position != null ? <span className="py-1">Position {queue.position} | {queue.waitingCount} waiting</span> : null}</div>
    {waiting ? <div className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-100"><span className="font-semibold">⏳ {(serverNow == null ? null : formatQueueCountdown(queue.queueExpiresAt, serverNow)) ?? 'Refreshing cancellation deadline from WIEZ'}</span>{queue.queueExpiresAt ? <div>Cancellation deadline: <time dateTime={queue.queueExpiresAt}>{new Date(queue.queueExpiresAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT</time></div> : null}</div> : null}
    {queue.adminPromotionHeld ? <p className="rounded-lg bg-rose-50 p-2 text-rose-800 dark:bg-rose-950 dark:text-rose-100">🛑 Admin promotion hold. This order stays Pending until released. Its cancellation deadline and cancellation rights continue.</p> : null}
    {waiting ? <p>Payment captured and held until Active. Cancellation deadlines apply even if a reminder is delayed.</p> : null}
    {waiting && queue.captureSummary ? <p className="font-semibold tabular-nums">Captured and held: {money(queue.captureSummary.heldAmount ?? queue.captureSummary.amount, queue.captureSummary.currency)}</p> : null}
    {queue.refundSummary ? <p>Refund: {queue.refundSummary.status ?? 'Processing'}{queue.refundSummary.amount != null ? ` | ${money(queue.refundSummary.amount, queue.refundSummary.currency)}` : ''}. Processing does not mean money has reached your bank.</p> : null}
  </div>;
}
export function QueueRefundBreakdown({ quote }: { quote: QueueRefundQuote }) {
  return <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">{[
    ['Captured', quote.capturedAmount], ['Garment subtotal', quote.garmentSubtotal], ['VAT withheld', quote.vatWithheld], ['10% garment cancellation fee', quote.garmentFeeWithheld], ['10% jump cancellation fee', quote.jumpFeeWithheld], ['Delivery refunded in full', quote.deliveryRefund], ['Total withheld', quote.totalWithheld], ['Refund requested', quote.refundAmount],
  ].filter(([, value]) => value != null).map(([label, value]) => <div key={String(label)} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-semibold tabular-nums">{money(Number(value), quote.currency)}</dd></div>)}</dl>;
}
type QueueAction = 'retain' | 'cancel' | 'promote' | 'demote' | 'release-hold' | 'resubmit';
export function QueueOrderActions({ orderId, queue: initial, audience, onChanged, access = 'MANAGE' }: { access?: 'READ' | 'MANAGE'; orderId: string; queue?: QueuePresenter | null; audience: 'buyer' | 'brand' | 'admin'; onChanged?: () => void | Promise<void> }) {
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
  const close = useCallback(() => { if (!busy) { requestRef.current += 1; setAction(null); setReason(''); setQuote(null); setQuoteError(''); } }, [busy]);
  useOverlayBackClose(Boolean(action), close, true);
  useEffect(() => { setUpdated(null); }, [initial]);
  useEffect(() => { requestRef.current += 1; setAction(null); setQuote(null); setUpdated(null); }, [orderId]);
  const queue = updated ?? initial;
  const tickNow = useQueueTick(queue?.lane === 'PENDING' || queue?.lane === 'UP_NEXT');
  if (!queue?.lane || queue.lane === 'NONE') return null;
  const waiting = queue.lane === 'PENDING' || queue.lane === 'UP_NEXT';
  const canRetainNow = canRetainQueue(queue, queueServerNow(queue, tickNow) ?? NaN);
  const canManage = access === 'MANAGE' && (audience !== 'admin' || hasPermission('moderation.write'));
  const canCancel = access === 'MANAGE' && queue.canCancel && (audience !== 'admin' || hasPermission('disputes.refund'));
  async function open(next: QueueAction) {
    const sequence = ++requestRef.current;
    setAction(next); setReason(''); setQuote(null); setQuoteError('');
    if (next === 'cancel') {
      try { const result = await (audience === 'admin' ? adminOrderQueueApi : customOrderQueueApi).refundQuote(orderId); if (requestRef.current === sequence) setQuote(result); }
      catch (error) { if (requestRef.current === sequence) setQuoteError(getFriendlyErrorMessage(error, 'Unable to load the current refund quote. Retry before cancelling.')); }
    }
  }
  async function submit() {
    if (!action || !queue) return;
    setBusy(true);
    try {
      if (action === 'resubmit') {
        const result = await customOrderQueueApi.resubmit(orderId);
        navigate(`/custom-orders/new?configurationId=${encodeURIComponent(result.configurationId)}&previousOrderId=${encodeURIComponent(orderId)}`);
      } else {
        const result = audience === 'admin' && action !== 'retain' ? await adminOrderQueueApi.action(orderId, action as 'cancel' | 'promote' | 'demote' | 'release-hold', reason.trim(), quote?.orderRevision ?? queue.orderRevision) : action === 'retain' ? await customOrderQueueApi.retain(orderId, queue.orderRevision) : await customOrderQueueApi.cancel(orderId, reason.trim(), quote?.orderRevision ?? queue.orderRevision);
        if (identityRef.current !== orderId) return;
        setUpdated(result);
        await Promise.all([['orders'], ['customOrders'], ['custom-order-queue-brand']].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        await onChanged?.();
      }
      toast.success(action === 'cancel' ? 'Cancellation recorded. Track refund processing on this order.' : action === 'retain' ? 'Position retained for another 42 days.' : 'Order updated.');
      setAction(null); setReason('');
    } catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'The order changed or the request failed. Refresh and try again.')); await onChanged?.(); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
    {updated ? <QueueFacts queue={updated} /> : null}
    <div className="flex flex-wrap gap-2">
      {audience === 'buyer' && canRetainNow ? <button className="queue-button" onClick={() => void open('retain')}>📌 Retain position</button> : null}
      {canCancel ? <button className="queue-button text-rose-700 dark:text-rose-200" onClick={() => void open('cancel')}>Cancel waiting order</button> : null}
      {audience === 'admin' && canManage && waiting ? <>{queue.adminPromotionHeld ? <button className="queue-button" onClick={() => void open('release-hold')}>Release promotion hold</button> : <button className="queue-button" onClick={() => void open(queue.lane === 'UP_NEXT' ? 'demote' : 'promote')}>{queue.lane === 'UP_NEXT' ? 'Demote to Pending' : 'Promote to Up Next'}</button>}</> : null}
      {audience === 'buyer' && queue.canResubmit ? <button className="queue-button" onClick={() => void open('resubmit')}>Resubmit with current quote</button> : null}
    </div>
    {audience === 'buyer' && waiting && !canRetainNow ? <p className="text-xs text-slate-500 dark:text-slate-400">One retain is available from 48 hours through exactly 12 hours before cancellation, if unused.</p> : null}
    <Modal open={Boolean(action)} onClose={close} title={action === 'cancel' ? 'Review cancellation and refund' : action === 'demote' ? 'Demote and hold promotion' : action === 'retain' ? 'Retain this position' : action === 'resubmit' ? 'Place a separate new order' : 'Confirm queue change'} size="sm">
      <div className="space-y-4 text-sm text-slate-800 dark:text-slate-100">
        {action === 'cancel' ? <><p>Every cancellation before Active withholds the snapshotted VAT, 10% of garment subtotal and 10% of any jump fee. Delivery is refunded in full. The refund is processed separately.</p>{quote ? <QueueRefundBreakdown quote={quote} /> : <p role="status">{quoteError || 'Loading the server refund quote…'}</p>}{quoteError ? <button className="queue-button" onClick={() => void open('cancel')}>Retry quote</button> : null}</> : null}
        {action === 'retain' ? <p>This one-time retain adds 42 days to the existing cancellation deadline and preserves your position. It does not start from today.</p> : null}
        {action === 'demote' ? <p>The order returns to Pending with a durable admin promotion hold, including when it is the only waiting order. Release the hold explicitly when it may progress. Cancellation and the expiry countdown continue.</p> : null}
        {action === 'promote' ? <p>The server checks capacity, the current Up Next order and queue eligibility before applying this change.</p> : null}
        {action === 'release-hold' ? <p>Release this order for normal queue progression. The existing cancellation deadline is preserved.</p> : null}
        {action === 'resubmit' ? <p>A new order requires a new payment, current prices, available intake and validated measurements. Any previous refund continues separately and cannot fund this payment.</p> : null}
        {action && !['retain', 'resubmit'].includes(action) ? <label className="block">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label> : null}
        <div className="flex flex-wrap justify-end gap-2"><button disabled={busy} className="queue-button" onClick={close}>Go back</button><button disabled={busy || (action === 'cancel' && !quote) || (!!action && !['retain', 'resubmit'].includes(action) && reason.trim().length < 3)} className="queue-button bg-violet-700 text-white disabled:opacity-50" onClick={() => void submit()}>{busy ? 'Processing…' : 'Confirm'}</button></div>
      </div>
    </Modal>
  </div>;
}
export function QueueBrandCounts({ brandId }: { brandId: string }) {
  const query = useQuery({ queryKey: ['custom-order-queue-brand', brandId], queryFn: () => customOrderQueueApi.brand(brandId), staleTime: 15000 });
  if (query.isPending) return <p role="status" className="text-sm">Loading current queue capacity…</p>;
  if (query.isError) return <div role="alert">Queue capacity unavailable. <button className="queue-button" onClick={() => void query.refetch()}>Retry</button></div>;
  const summary = query.data;
  return <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-slate-900 dark:border-violet-900 dark:bg-slate-950 dark:text-white"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">🧵 {queueTierName(summary.capacity.tierKey)} queue</h2><span>{!summary.intakeAllowed ? 'New intake paused' : 'Accepting new orders'}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(summary.counts).map(([lane, count]) => <div key={lane}><div className="text-lg font-bold tabular-nums">{count}{lane === 'ACTIVE' ? ` / ${summary.capacity.active ?? 'Unlimited'}` : lane === 'IN_DELIVERY' ? ` / ${summary.capacity.inDelivery ?? 'Unlimited'}` : lane === 'UP_NEXT' ? ' / 1' : ''}</div><div className="text-xs">{queueLaneLabels[lane]}</div></div>)}</div></section>;
}
