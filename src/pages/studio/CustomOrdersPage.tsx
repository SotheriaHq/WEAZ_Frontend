import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import {
  customOrdersBrandApi,
  type CustomOrderDetail,
  type CustomOrderListItem,
  type CustomOrderProgressStage,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import {
  CustomOrderBadge,
  CustomOrderJsonBreakdown,
  CustomOrderKeyValueList,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import CustomOrderActionConfirmModal from '@/components/custom-orders/CustomOrderActionConfirmModal';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';

interface PendingBrandAction {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  execute: () => Promise<boolean>;
}

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const stageOptions: CustomOrderProgressStage[] = [
  'ORDER_RECEIVED',
  'FABRIC_AND_PIECE_PURCHASE_GATHERING',
  'DESIGN_MODE',
  'FINAL_TOUCHES_AND_PACKAGING',
  'READY_FOR_DELIVERY',
];

const lifecycleOptions: CustomOrderStatus[] = [
  'READY_FOR_DISPATCH',
  'IN_TRANSIT',
  'DELIVERED_PENDING_BUYER_CONFIRMATION',
  'CLOSED',
];

const CustomOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomOrderListItem[]>([]);
  const [selected, setSelected] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [acceptNote, setAcceptNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [progressStage, setProgressStage] = useState<CustomOrderProgressStage>('ORDER_RECEIVED');
  const [progressNote, setProgressNote] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDays, setExtensionDays] = useState('2');
  const [lifecycleStatus, setLifecycleStatus] = useState<CustomOrderStatus>('IN_PRODUCTION');
  const [lifecycleNote, setLifecycleNote] = useState('');
  const [counterResponse, setCounterResponse] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [counterNote, setCounterNote] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingBrandAction | null>(null);
  const [summaryByOrderId, setSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const refreshSequenceRef = useRef(0);

  const loadDetail = async (currentBrandId: string, targetOrderId: string, sequence?: number) => {
    const detail = await customOrdersBrandApi.getById(currentBrandId, targetOrderId);
    if (typeof sequence === 'number' && refreshSequenceRef.current !== sequence) {
      return;
    }
    setSelected(detail);
    setProgressStage(detail.currentProgressStage ?? 'ORDER_RECEIVED');
    setLifecycleStatus(
      lifecycleOptions.includes(detail.status) ? detail.status : 'IN_PRODUCTION',
    );
  };

  const refresh = async () => {
    const sequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = sequence;

    try {
      setLoading(true);
      const status = await getStoreStatus();
      if (refreshSequenceRef.current !== sequence) {
        return;
      }
      setBrandId(status.brandId);
      const list = await customOrdersBrandApi.list(status.brandId, {
        status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined,
        q: deferredSearchQuery || undefined,
        limit: 25,
      });
      if (refreshSequenceRef.current !== sequence) {
        return;
      }
      setOrders(list.items);

      const orderIds = list.items.map((entry) => entry.id);
      if (orderIds.length === 0) {
        setSummaryByOrderId({});
      } else {
        const bulkSummaries = await messagingApi.getBulkCustomOrderSummariesForBrand(
          status.brandId,
          orderIds,
          true,
        );
        if (refreshSequenceRef.current !== sequence) {
          return;
        }
        setSummaryByOrderId(
          bulkSummaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
      }

      if (orderId) {
        void loadDetail(status.brandId, orderId, sequence).catch((error: any) => {
          if (refreshSequenceRef.current !== sequence) {
            return;
          }
          toast.error(error?.response?.data?.message || 'Unable to load custom-order detail');
        });
      } else {
        setSelected(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load brand custom orders');
    } finally {
      if (refreshSequenceRef.current === sequence) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refresh();
  }, [deferredSearchQuery, orderId, statusFilter]);

  const totals = useMemo(() => {
    return {
      total: orders.length,
      pendingAcceptance: orders.filter((entry) => entry.status === 'PENDING_BRAND_ACCEPTANCE').length,
      liveProduction: orders.filter((entry) => ['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(entry.status)).length,
    };
  }, [orders]);

  const latestCounteredExtension = useMemo(
    () => selected?.extensionRequests.find((entry) => entry.buyerResponseStatus === 'COUNTERED') ?? null,
    [selected?.extensionRequests],
  );

  const selectedMeasurementEntries = useMemo(
    () => Object.entries(selected?.measurementSnapshot ?? {}),
    [selected?.measurementSnapshot],
  );

  const runAction = async (work: (currentBrandId: string) => Promise<unknown>, successMessage: string) => {
    if (!brandId || !selected) return false;
    setBusy(true);
    try {
      await work(brandId);
      toast.success(successMessage);
      await refresh();
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update custom order');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const didSucceed = await pendingAction.execute();
    if (didSucceed) {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Studio</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Custom orders</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review paid orders, move production stages, and manage extension requests.</p>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-3">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/5"><div className="text-xs uppercase tracking-wide text-slate-500">Total</div><div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{totals.total}</div></div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/5"><div className="text-xs uppercase tracking-wide text-slate-500">Pending</div><div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{totals.pendingAcceptance}</div></div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/5"><div className="text-xs uppercase tracking-wide text-slate-500">Active</div><div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{totals.liveProduction}</div></div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap gap-3">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search title" className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
              <option value="">All statuses</option>
              <option value="PENDING_BRAND_ACCEPTANCE">Pending brand acceptance</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IN_PRODUCTION">In production</option>
              <option value="IN_TRANSIT">In transit</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading brand queue...</div> : null}
            {!loading && orders.length === 0 ? <div className="text-sm text-slate-500 dark:text-slate-400">No custom orders match this view.</div> : null}
            {orders.map((entry) => (
              (() => {
                const summary = summaryByOrderId[entry.id];
                const unreadCount = Number(summary?.unreadCount ?? 0);
                return (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(`/studio/custom-orders/${entry.id}`)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selected?.id === entry.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 bg-white/70 hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]'}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{entry.sourceTitle}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{entry.status} • {entry.currentProgressStage ?? 'Awaiting action'}</span>
                      {summary?.hasUnread ? (
                        <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          💬 {unreadCount > 0 ? `${unreadCount} unread` : 'New messages'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(entry.buyerPriceSummary.grandTotal, entry.buyerPriceSummary.currency)}
                  </div>
                </div>
              </button>
                );
              })()
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          {!selected ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Select a custom order to review details and brand actions.</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CustomOrderBadge value={selected.status} />
                  <CustomOrderBadge value={selected.paymentStatus} type="payment" />
                  <CustomOrderBadge value={selected.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{selected.source.title}</h2>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Payment: {selected.paymentStatus} • Current stage: {selected.currentProgressStage ?? 'Awaiting acceptance'}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CustomOrderMetricCard label="Measurement confirmed" value={formatDateTime(selected.measurementConfirmedAt)} helper="Buyer-approved snapshot" />
                <CustomOrderMetricCard label="Offer version" value={selected.offerVersionId} helper="Immutable order pricing version" />
                <CustomOrderMetricCard label="Production deadline" value={formatDateTime(selected.promisedProductionAt)} helper={getRelativeDeadlineText(selected.promisedProductionAt)} />
                <CustomOrderMetricCard label="Delivery deadline" value={formatDateTime(selected.promisedDeliveryAt)} helper={getRelativeDeadlineText(selected.promisedDeliveryAt)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Source and policy snapshot</div>
                  <CustomOrderKeyValueList
                    items={[
                      { label: 'Source type', value: selected.source.type },
                      { label: 'Source title', value: selected.source.title },
                      { label: 'Brand', value: selected.source.brandName ?? 'Brand' },
                      { label: 'Promised dispatch', value: formatDateTime(selected.promisedDispatchAt) },
                      { label: 'Buyer acceptance window', value: formatDateTime(selected.buyerAcceptanceWindowEndsAt) },
                    ]}
                  />
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Measurement snapshot</div>
                  <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                    {selectedMeasurementEntries.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No measurements were attached to this order.</div>
                    ) : (
                      selectedMeasurementEntries.map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-4 rounded-2xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.03]">
                          <span>{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{String(value)} cm</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Internal price breakdown</div>
                <CustomOrderJsonBreakdown data={selected.internalPriceBreakdown as Record<string, unknown> | null | undefined} />
              </div>

              <OrderMessagesPanel
                contextType="CUSTOM_ORDER"
                orderId={selected.id}
                title="Brand conversation"
                actorSurface="BRAND"
                brandId={brandId}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Brand review</div>
                  <textarea value={acceptNote} onChange={(event) => setAcceptNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Acceptance note" />
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setPendingAction({
                          title: 'Accept custom order?',
                          description: 'This confirms the brand can fulfill the order at the locked price and timeline. The buyer has already paid in full.',
                          confirmLabel: 'Accept order',
                          execute: () => runAction((currentBrandId) => customOrdersBrandApi.accept(currentBrandId, selected.id, acceptNote), 'Custom order accepted'),
                        })
                      }
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy || rejectReason.trim().length < 5}
                      onClick={() =>
                        setPendingAction({
                          title: 'Reject custom order?',
                          description: 'Rejecting this paid order will move it out of the acceptance flow and can trigger refund handling. Make sure the rejection reason is complete and accurate.',
                          confirmLabel: 'Reject order',
                          tone: 'danger',
                          execute: () => runAction((currentBrandId) => customOrdersBrandApi.reject(currentBrandId, selected.id, rejectReason.trim()), 'Custom order rejected'),
                        })
                      }
                      className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                  <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                </div>

                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Production stage</div>
                  <select value={progressStage} onChange={(event) => setProgressStage(event.target.value as CustomOrderProgressStage)} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                  <textarea value={progressNote} onChange={(event) => setProgressNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Progress note" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setPendingAction({
                        title: 'Update production stage?',
                        description: `This will publish ${progressStage.replace(/_/g, ' ').toLowerCase()} as the latest buyer-visible production stage for this order.`,
                        confirmLabel: 'Save stage',
                        execute: () => runAction((currentBrandId) => customOrdersBrandApi.updateProgressStage(currentBrandId, selected.id, { stage: progressStage, note: progressNote }), 'Progress stage updated'),
                      })
                    }
                    className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                  >
                    Save stage
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Extension request</div>
                  <input value={extensionDays} onChange={(event) => setExtensionDays(event.target.value)} placeholder="Extra days" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                  <textarea value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Why is more time needed?" />
                  <button
                    type="button"
                    disabled={busy || extensionReason.trim().length < 5}
                    onClick={() =>
                      setPendingAction({
                        title: 'Request buyer extension approval?',
                        description: `This will ask the buyer to approve ${extensionDays} additional day(s) across production and delivery. Buyer rejection escalates the order for support review.`,
                        confirmLabel: 'Request extension',
                        execute: () => runAction((currentBrandId) => customOrdersBrandApi.createExtensionRequest(currentBrandId, selected.id, { targetType: 'BOTH', requestedExtraDays: Number(extensionDays), reason: extensionReason.trim() }), 'Extension request sent'),
                      })
                    }
                    className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                  >
                    Request extension
                  </button>
                </div>

                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Lifecycle override</div>
                  <select value={lifecycleStatus} onChange={(event) => setLifecycleStatus(event.target.value as CustomOrderStatus)} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    {lifecycleOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <textarea value={lifecycleNote} onChange={(event) => setLifecycleNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Lifecycle note" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setPendingAction({
                        title: 'Override lifecycle status?',
                        description: `This will set the order lifecycle to ${lifecycleStatus.replace(/_/g, ' ').toLowerCase()}. Use it only when the status change accurately reflects the order state.`,
                        confirmLabel: 'Update lifecycle',
                        execute: () => runAction((currentBrandId) => customOrdersBrandApi.updateLifecycleStatus(currentBrandId, selected.id, { status: lifecycleStatus, note: lifecycleNote }), 'Lifecycle status updated'),
                      })
                    }
                    className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                  >
                    Update lifecycle
                  </button>
                </div>
              </div>

              {latestCounteredExtension ? (
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Buyer counter-resolution</div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Buyer countered the extension request with {latestCounteredExtension.buyerCounterDays ?? 0} additional day(s).
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                    <select value={counterResponse} onChange={(event) => setCounterResponse(event.target.value as 'ACCEPTED' | 'REJECTED')} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                      <option value="ACCEPTED">Accept buyer counter</option>
                      <option value="REJECTED">Reject buyer counter</option>
                    </select>
                    <input value={counterNote} onChange={(event) => setCounterNote(event.target.value)} placeholder="Optional note" className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setPendingAction({
                        title: 'Resolve buyer counter?',
                        description: `This will ${counterResponse === 'ACCEPTED' ? 'accept' : 'reject'} the buyer's countered extension request and finalize that negotiation step.`,
                        confirmLabel: 'Resolve counter',
                        execute: () => runAction((currentBrandId) => customOrdersBrandApi.respondToBuyerCounter(currentBrandId, selected.id, latestCounteredExtension.id, { response: counterResponse, note: counterNote || undefined }), 'Buyer counter resolved'),
                      })
                    }
                    className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                  >
                    Resolve counter
                  </button>
                </div>
              ) : null}

              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Progress timeline</div>
                <div className="mt-3 space-y-3">
                  {selected.progressEvents.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No brand progress events recorded yet.</div>
                  ) : (
                    selected.progressEvents.map((event) => (
                      <div key={event.id} className="rounded-2xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CustomOrderBadge value={event.stage} type="stage" />
                          <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.changedAt)}</div>
                        </div>
                        {event.note ? <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{event.note}</div> : null}
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Stale threshold: {formatDateTime(event.staleThresholdAt)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <CustomOrderActionConfirmModal
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        confirmLabel={pendingAction?.confirmLabel ?? 'Confirm'}
        tone={pendingAction?.tone ?? 'default'}
        busy={busy}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          void confirmPendingAction();
        }}
      />
    </div>
  );
};

export default CustomOrdersPage;