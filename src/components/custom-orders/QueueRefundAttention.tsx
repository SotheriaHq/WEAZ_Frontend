import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useQueueConfirm } from './useQueueConfirm';

interface QueueRefund { id: string; customOrderId: string; amount: number; currency: string; status: string; providerRefundId: string | null; lastError: string | null; createdAt: string }
export default function QueueRefundAttention() {
  const { hasPermission } = useAdminPermissions();
  const [ids, setIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const enabled = hasPermission('disputes.refund');
  const query = useQuery({ queryKey: ['admin-queue-refund-attention', cursor], queryFn: async () => unwrapApiResponse<{ refunds: QueueRefund[]; nextCursor?: string | null }>((await apiClient.get('/admin/custom-order-queue/refunds', { params: { cursor } })).data), enabled });
  async function reconcile(refund: QueueRefund) {
    const providerRefundId = ids[refund.id]?.trim() || refund.providerRefundId;
    if (!providerRefundId || !(await confirm({ title: 'Verify an existing custom-order refund?', message: 'This reconciles the provider refund ID against the recorded custom-order liability and capture. It does not submit another refund. Use a refund ID that already exists at the payment provider.', confirmText: 'Verify refund' }))) return;
    setBusy(refund.id);
    try { await apiClient.post(`/admin/custom-order-queue/refunds/${refund.id}/reconcile`, { providerRefundId }); await query.refetch(); toast.success('Custom-order refund reconciled.'); }
    catch (error) { toast.error(getFriendlyErrorMessage(error, 'Unable to verify this refund. Check its provider refund ID.')); }
    finally { setBusy(null); }
  }
  if (!enabled) return null;
  return <section className="queue-section">{ConfirmDialog}<h2 className="font-bold">Custom-order refunds needing reconciliation</h2><p className="text-sm">These are existing component refund obligations, including partial refunds from a mixed payment. An unknown provider result must be verified before any new financial action. Pending records appear in pages of 100.</p>{query.isPending ? <p role="status">Loading refund obligations…</p> : query.isError ? <p role="alert">Unable to load pending refunds. <button className="queue-button" onClick={() => void query.refetch()}>Retry</button></p> : query.data.refunds.length === 0 ? <p className="text-sm">No custom-order refunds need reconciliation.</p> : query.data.refunds.map((refund) => <article className="space-y-2 border-b border-slate-200 py-4 last:border-0 dark:border-slate-800" key={refund.id}><p className="font-semibold tabular-nums">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: refund.currency }).format(refund.amount)} · {refund.status}</p><Link className="break-all text-sm underline" to={`/admin/custom-orders/${refund.customOrderId}`}>Open order {refund.customOrderId}</Link>{refund.lastError ? <p className="break-words text-xs">Attention: {refund.lastError}</p> : null}<label className="block text-sm">Existing provider refund ID<input className="mt-1 w-full rounded-xl border bg-white p-3 dark:bg-slate-950" value={ids[refund.id] ?? refund.providerRefundId ?? ''} onChange={(event) => setIds((current) => ({ ...current, [refund.id]: event.target.value }))} autoComplete="off" spellCheck={false} /></label><button className="queue-button" disabled={Boolean(busy) || !(ids[refund.id]?.trim() || refund.providerRefundId)} onClick={() => void reconcile(refund)}>{busy === refund.id ? 'Verifying…' : 'Verify existing refund'}</button></article>)}<nav aria-label="Refund obligation pages" className="flex flex-wrap gap-3"><button className="queue-button" disabled={!cursors.length || query.isFetching || Boolean(busy)} onClick={() => setCursors(previous => previous.slice(0, -1))}>Previous refunds</button><button className="queue-button" disabled={!query.data?.nextCursor || query.isFetching || Boolean(busy)} onClick={() => { if (query.data?.nextCursor) setCursors(previous => [...previous, query.data.nextCursor!]); }}>Next refunds</button></nav></section>;
}
