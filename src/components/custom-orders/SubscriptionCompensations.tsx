import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useQueueConfirm } from './useQueueConfirm';

interface SubscriptionCapture {
  id: string;
  invoiceId: string;
  brandId: string;
  brandName: string;
  reference: string;
  invoiceReference: string;
  amountNgn: number;
  currency: string;
  paidAt: string | null;
  status: string;
  reason: string | null;
  providerRefundId: string | null;
  lastError: string | null;
  createdAt: string;
  refundedAt: string | null;
  nextAttemptAt: string | null;
}

export default function SubscriptionCompensations() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const { hasPermission } = useAdminPermissions();
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const canRead = hasPermission('payouts.read');
  const canProcess = hasPermission('payouts.process');
  const query = useQuery({
    queryKey: ['subscription-compensations', cursor],
    enabled: canRead,
    queryFn: async () => unwrapApiResponse<{ captures: SubscriptionCapture[]; nextCursor: string | null; serverNow: string }>((await apiClient.get('/admin/subscriptions/compensations', { params: { cursor, limit: 25 } })).data),
  });
  async function reconcile(capture: SubscriptionCapture) {
    const providerRefundId = providerIds[capture.id]?.trim() || capture.providerRefundId || undefined;
    if (!providerRefundId) { toast.error('Enter the existing provider refund ID to verify an unknown refund.'); return; }
    if (!(await confirm({ title: 'Reconcile existing subscription refund?', message: 'WIEZ will verify the supplied provider refund against this capture, including its amount, currency and reference. This action does not submit a new refund. Use the existing refund ID from the payment provider.', confirmText: 'Verify existing refund' }))) return;
    setBusyId(capture.id);
    try {
      await apiClient.post(`/admin/subscriptions/compensations/${capture.id}/reconcile`, { providerRefundId });
      await query.refetch(); toast.success('Provider refund status reconciled.');
    } catch (error) { toast.error(getFriendlyErrorMessage(error, 'Unable to reconcile this refund. Check the existing provider refund ID and try again.')); }
    finally { setBusyId(null); }
  }
  if (!canRead) return null;
  return <section className="space-y-4 rounded-2xl border border-amber-200 p-4 text-slate-900 dark:border-amber-900 dark:text-white">
    {ConfirmDialog}<h2 className="font-bold">🧾 Subscription capture compensation</h2>
    <p className="text-sm">Captured payments that could not grant the purchased subscription remain tracked refund obligations. An unknown provider result requires reconciliation before another financial action. A processing status does not confirm bank receipt.</p>
    {query.isPending ? <p role="status">Loading subscription refund obligations…</p> : query.isError ? <p role="alert">Unable to load subscription compensation. <button className="queue-button" onClick={() => void query.refetch()}>Retry</button></p> : query.data.captures.length === 0 ? <p className="text-sm">No subscription captures require compensation.</p> : query.data.captures.map((capture) => <article key={capture.id} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="break-words font-semibold">{capture.brandName} · {capture.status}</h3><p className="font-semibold tabular-nums">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: capture.currency || 'NGN' }).format(capture.amountNgn)}</p>
      <dl className="space-y-1 break-words text-xs"><div>Capture: {capture.reference}</div><div>Invoice: {capture.invoiceReference}</div><div>Reason: {capture.reason || 'Subscription could not be fulfilled'}</div>{capture.lastError ? <div>Attention: {capture.lastError}</div> : null}{capture.refundedAt ? <div>Provider refund confirmed: {new Date(capture.refundedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT</div> : null}</dl>
      {capture.status !== 'REFUNDED' && canProcess ? <div className="space-y-2"><label className="block text-sm">Existing payment-provider refund ID<input className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950" value={providerIds[capture.id] ?? capture.providerRefundId ?? ''} onChange={(event) => setProviderIds((current) => ({ ...current, [capture.id]: event.target.value }))} autoComplete="off" spellCheck={false} /></label><button className="queue-button" disabled={Boolean(busyId) || !(providerIds[capture.id]?.trim() || capture.providerRefundId)} onClick={() => void reconcile(capture)}>{busyId === capture.id ? 'Verifying…' : 'Verify existing refund'}</button></div> : null}
    </article>)}
    <div className="flex flex-wrap gap-2"><button className="queue-button" disabled={!cursor || query.isFetching} onClick={() => setCursor(undefined)}>First page</button><button className="queue-button" disabled={!query.data?.nextCursor || query.isFetching} onClick={() => setCursor(query.data?.nextCursor ?? undefined)}>Next page</button></div>
  </section>;
}
