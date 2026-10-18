import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { CustomOrderListItem } from '@/api/CustomOrderApi';
import { customOrderQueueApi, type QueueRefundQuote } from '@/api/CustomOrderQueueApi';
import Modal from '@/components/ui/Modal';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { QueueRefundBreakdown } from './CustomOrderQueue';

export default function QueueBulkCancellation({ brandId, orders, onChanged }: { brandId: string; orders: CustomOrderListItem[]; onChanged: () => Promise<unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, QueueRefundQuote>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [results, setResults] = useState<Array<{id: string; cancelled: boolean; message?: string}>>([]);
  const eligible = orders.filter((order) => order.queue?.canCancel);
  const ids = selected.filter((id) => eligible.some((order) => order.id === id));
  const close = useCallback(() => { if (!busy) setReview(false); }, [busy]);
  useOverlayBackClose(review, close, true);
  async function preview() {
    setReview(true); setBusy(true); setQuoteError(''); setQuotes({});
    try {
      const results = await Promise.all(ids.map(async (id) => [id, await customOrderQueueApi.refundQuote(id)] as const));
      setQuotes(Object.fromEntries(results));
    } catch (error: unknown) { setQuoteError(getFriendlyErrorMessage(error, 'Unable to quote every selected order. Refresh and retry.')); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (reason.trim().length < 3 || ids.length === 0) return;
    setBusy(true);
    try {
      const response = await customOrderQueueApi.cancelMany(brandId, ids, reason.trim());
      setResults(response.results);
      setReview(false); setSelected([]); setExpanded(false); setReason(''); await onChanged();
      toast.success(`${response.results.filter((item) => item.cancelled).length} cancellations recorded. Review individual results below.`);
    } catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Bulk cancellation failed. Refresh before retrying.')); await onChanged(); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
    {results.length ? <div role="status" className="space-y-2 text-sm"><h3 className="font-semibold">Cancellation results</h3>{results.map((result) => <p key={result.id} className="break-words">{orders.find((order) => order.id === result.id)?.sourceTitle || result.id}: {result.cancelled ? 'Cancelled; refund processing separately' : result.message || 'Not cancelled; refresh this order before retrying'}</p>)}</div> : null}
    <button className="queue-button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>Review waiting-order cancellations</button>
    {expanded ? <><p className="text-sm">Only paid orders before Active can be cancelled here. Every selected order uses its own frozen refund components. More than five cancellations in one action or a rolling 24 hours raises an admin attention alert.</p><div className="space-y-2">{eligible.length === 0 ? <p>No cancellable waiting orders in this page.</p> : eligible.map((order) => <label key={order.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input className="mt-1" type="checkbox" checked={ids.includes(order.id)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, order.id] : previous.filter((id) => id !== order.id))} /><span className="min-w-0 break-words">{order.sourceTitle} · {order.id}</span></label>)}</div><button className="queue-button" disabled={!ids.length || busy} onClick={() => void preview()}>Preview refunds for {ids.length} selected</button></> : null}
    <Modal open={review} onClose={close} title="Review bulk cancellation" size="md"><div className="space-y-4 text-sm">
      <p>VAT, 10% of garment subtotal and 10% of any jump fee are withheld for every pre-Active cancellation. Delivery is refunded in full. Existing Active orders are protected.</p>
      {busy && !Object.keys(quotes).length ? <p role="status">Loading current refund quotes…</p> : null}
      {quoteError ? <p role="alert">{quoteError} <button className="queue-button" onClick={() => void preview()}>Retry quotes</button></p> : null}
      {ids.map((id) => quotes[id] ? <section className="space-y-2" key={id}><h3 className="break-words font-semibold">{eligible.find((order) => order.id === id)?.sourceTitle}</h3><QueueRefundBreakdown quote={quotes[id]} /></section> : null)}
      <label className="block">Reason for all selected cancellations<textarea className="mt-2 w-full rounded-xl border bg-white p-3 dark:bg-slate-950" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label>
      <div className="flex flex-wrap justify-end gap-2"><button className="queue-button" disabled={busy} onClick={close}>Go back</button><button className="queue-button bg-rose-700 text-white" disabled={busy || reason.trim().length < 3 || ids.length === 0 || Object.keys(quotes).length !== ids.length} onClick={() => void cancel()}>{busy ? 'Processing…' : `Cancel ${ids.length} orders`}</button></div>
    </div></Modal>
  </section>;
}
