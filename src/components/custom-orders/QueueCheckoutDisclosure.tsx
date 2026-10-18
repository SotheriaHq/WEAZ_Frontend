import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customOrderQueueApi } from '@/api/CustomOrderQueueApi';
import { QueueFacts } from './CustomOrderQueue';

type PriceSummary = { subtotal?: number; queueJumpFee?: number; vatAmount?: number; shippingFee?: number; currency?: string };
export function QueuePriceDisclosure({ summary }: { summary: PriceSummary }) {
  const format = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: summary.currency || 'NGN' }).format(amount);
  return <div className="mt-2 space-y-1 break-words text-xs text-slate-600 dark:text-slate-300">
    <dl className="space-y-1">{[['Garment subtotal', summary.subtotal], ['Paid queue jump', summary.queueJumpFee], ['VAT', summary.vatAmount], ['Delivery', summary.shippingFee]].map(([label, value]) => value != null ? <div key={String(label)} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd>{format(Number(value))}</dd></div> : null)}</dl>
    {(summary.queueJumpFee ?? 0) > 0 ? <p>Paid priority preserves the current Up Next. Paid jumps remain FIFO, with at most two priority promotions before an ordinary waiting order. It does not guarantee immediate production.</p> : null}
    <p>Custom-order payment is captured at placement and held until Active. Pending and Up Next expire after 42 days; the order cards show the cancellation countdown.</p>
    <p>All pre-Active cancellations withhold the recorded VAT, 10% of garment subtotal and 10% of any jump fee. Delivery is fully refunded. <Link className="underline" to="/payment-policy" target="_blank" rel="noopener noreferrer">Payment policy</Link></p>
  </div>;
}

export function QueuePaymentOutcome({ customOrderIds }: { customOrderIds: string[] }) {
  const ids = [...new Set(customOrderIds)].slice(0, 100).sort();
  const query = useQuery({ queryKey: ['custom-order-payment-queue', ids], queryFn: () => customOrderQueueApi.summaries(ids), enabled: ids.length > 0, staleTime: 0 });
  if (!ids.length) return null;
  return <section className="my-4 space-y-3 rounded-2xl border border-violet-200 p-4 text-left text-slate-900 dark:border-violet-900 dark:text-white"><h2 className="font-bold">🧵 Custom-order queue</h2>
    {query.isPending ? <p role="status">Loading committed queue positions…</p> : query.isError ? <p role="alert">Queue results are not available yet. A waiting lane does not require a second payment. <button className="queue-button" onClick={() => void query.refetch()}>Refresh queue status</button></p> : Object.entries(query.data.orders).map(([id, queue]) => <article className="space-y-2" key={id}><QueueFacts queue={queue} /><Link className="queue-button inline-flex" to={`/custom-orders/${id}`}>Open order</Link></article>)}
    <p className="text-xs">Payment capture, queue admission and refund processing are confirmed by WIEZ. Retrying this status check does not create a new charge.</p>
  </section>;
}
