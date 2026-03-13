import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  customOrdersAdminApi,
  type CustomFabricRuleBasis,
  type CustomFabricRuleBasisStatus,
  type CustomOrderDetail,
  type CustomOrderDisputeListItem,
  type CustomOrderDisputeResolution,
  type CustomOrderDisputeStatus,
  type CustomOrderLedgerAllocation,
  type CustomOrderListItem,
  type CustomOrderRefundReviewListItem,
  type CustomOrderRetentionHoldType,
  type CustomOrderRiskDashboard,
  type CustomOrderStaleItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
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

interface PendingAdminAction {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  execute: () => Promise<boolean>;
}

const AdminCustomOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [orders, setOrders] = useState<CustomOrderListItem[]>([]);
  const [risk, setRisk] = useState<CustomOrderRiskDashboard | null>(null);
  const [refundReviews, setRefundReviews] = useState<CustomOrderRefundReviewListItem[]>([]);
  const [staleOrders, setStaleOrders] = useState<CustomOrderStaleItem[]>([]);
  const [disputes, setDisputes] = useState<CustomOrderDisputeListItem[]>([]);
  const [pendingBases, setPendingBases] = useState<CustomFabricRuleBasis[]>([]);
  const [ledgerAllocations, setLedgerAllocations] = useState<CustomOrderLedgerAllocation[]>([]);
  const [selected, setSelected] = useState<CustomOrderDetail | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>('');
  const [selectedBasisId, setSelectedBasisId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [riskReason, setRiskReason] = useState('');
  const [riskNote, setRiskNote] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [disputeStatus, setDisputeStatus] = useState<CustomOrderDisputeStatus>('ADMIN_REVIEW');
  const [disputeResolution, setDisputeResolution] = useState<CustomOrderDisputeResolution>('NO_ACTION');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [basisStatus, setBasisStatus] = useState<CustomFabricRuleBasisStatus>('APPROVED_GLOBAL');
  const [basisNotes, setBasisNotes] = useState('');
  const [retentionHoldType, setRetentionHoldType] = useState<CustomOrderRetentionHoldType>('SUPPORT');
  const [retentionHoldReason, setRetentionHoldReason] = useState('');
  const [retentionHoldUntil, setRetentionHoldUntil] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const refreshSequenceRef = useRef(0);

  const selectedDispute = useMemo(
    () => disputes.find((entry) => entry.id === selectedDisputeId) ?? null,
    [disputes, selectedDisputeId],
  );

  const selectedBasis = useMemo(
    () => pendingBases.find((entry) => entry.id === selectedBasisId) ?? null,
    [pendingBases, selectedBasisId],
  );

  const loadSelection = async (targetOrderId: string, sequence: number) => {
    const [detail, allocationData] = await Promise.all([
      customOrdersAdminApi.getById(targetOrderId),
      customOrdersAdminApi.getLedgerAllocations({ customOrderId: targetOrderId, limit: 50 }),
    ]);

    if (refreshSequenceRef.current !== sequence) {
      return;
    }

    setSelected(detail);
    setLedgerAllocations(allocationData.items);
  };

  const loadSecondaryPanels = async (sequence: number) => {
    const [refundData, staleData, disputeData, pendingBasesData] = await Promise.all([
      customOrdersAdminApi.getRefundReviews({ limit: 8 }),
      customOrdersAdminApi.getStaleOrders({ limit: 8 }),
      customOrdersAdminApi.listDisputes({ limit: 8 }),
      customOrdersAdminApi.getPendingFabricRuleBases(),
    ]);

    if (refreshSequenceRef.current !== sequence) {
      return;
    }

    setRefundReviews(refundData.items);
    setStaleOrders(staleData.items);
    setDisputes(disputeData.items);
    setPendingBases(pendingBasesData);
  };

  const refresh = async () => {
    const sequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = sequence;

    try {
      setLoading(true);
      const [riskData, ordersData] = await Promise.all([
        customOrdersAdminApi.getRiskDashboard({ days: 30, limit: 6 }),
        customOrdersAdminApi.list({ limit: 20, q: deferredSearchQuery || undefined, status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined }),
      ]);

      if (refreshSequenceRef.current !== sequence) {
        return;
      }

      setRisk(riskData);
      setOrders(ordersData.items);
      if (orderId) {
        void loadSelection(orderId, sequence).catch((error: any) => {
          if (refreshSequenceRef.current !== sequence) {
            return;
          }
          toast.error(error?.response?.data?.message || 'Unable to load admin custom-order detail');
        });
      } else {
        setSelected(null);
        setLedgerAllocations([]);
      }
      void loadSecondaryPanels(sequence).catch((error: any) => {
        if (refreshSequenceRef.current !== sequence) {
          return;
        }
        toast.error(error?.response?.data?.message || 'Unable to load admin custom-order side panels');
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load admin custom-order console');
    } finally {
      if (refreshSequenceRef.current === sequence) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refresh();
  }, [deferredSearchQuery, orderId, statusFilter]);

  useEffect(() => {
    if (disputes.length > 0 && !selectedDisputeId) {
      setSelectedDisputeId(disputes[0].id);
    }
  }, [disputes, selectedDisputeId]);

  useEffect(() => {
    if (selectedDispute) {
      setDisputeStatus((selectedDispute.status as CustomOrderDisputeStatus) ?? 'ADMIN_REVIEW');
      setDisputeResolution((selectedDispute.resolution as CustomOrderDisputeResolution) ?? 'NO_ACTION');
      setDisputeNotes(selectedDispute.adminNotes ?? '');
    }
  }, [selectedDispute]);

  useEffect(() => {
    if (pendingBases.length > 0 && !selectedBasisId) {
      setSelectedBasisId(pendingBases[0].id);
    }
  }, [pendingBases, selectedBasisId]);

  useEffect(() => {
    if (selectedBasis) {
      setBasisStatus(selectedBasis.status === 'REJECTED' ? 'REJECTED' : 'APPROVED_GLOBAL');
      setBasisNotes(selectedBasis.moderationNotes ?? '');
    }
  }, [selectedBasis]);

  useEffect(() => {
    if (!selected) {
      setRetentionHoldType('SUPPORT');
      setRetentionHoldReason('');
      setRetentionHoldUntil('');
      return;
    }

    setRetentionHoldType((selected.retentionHoldType as CustomOrderRetentionHoldType | null) ?? 'SUPPORT');
    setRetentionHoldReason(selected.retentionHoldReason ?? '');
    setRetentionHoldUntil(
      selected.retentionHoldUntil ? new Date(selected.retentionHoldUntil).toISOString().slice(0, 16) : '',
    );
  }, [selected]);

  const runAction = async (work: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(successMessage);
      await refresh();
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update admin custom-order action');
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
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Admin</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Custom orders</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Monitor risk, intervene on stale orders, review disputes, and moderate fabric-rule bases.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <CustomOrderMetricCard label="Placed" value={risk?.overview.ordersPlaced ?? '—'} />
        <CustomOrderMetricCard label="Disputes" value={risk?.overview.disputesOpened ?? '—'} />
        <CustomOrderMetricCard label="Refunds" value={risk?.overview.refundsInitiated ?? '—'} />
        <CustomOrderMetricCard label="Stale" value={risk?.overview.currentStaleOrders ?? '—'} />
        <CustomOrderMetricCard label="SLA risk" value={risk?.overview.currentAcceptanceSlaRisk ?? '—'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap gap-3">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search custom orders" className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
              <option value="">All statuses</option>
              <option value="DISPUTED">Disputed</option>
              <option value="REFUND_IN_PROGRESS">Refund in progress</option>
              <option value="PENDING_BRAND_ACCEPTANCE">Pending acceptance</option>
              <option value="IN_PRODUCTION">In production</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading order queue...</div> : null}
            {orders.map((entry) => (
              <button key={entry.id} type="button" onClick={() => navigate(`/admin/custom-orders/${entry.id}`)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selected?.id === entry.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 bg-white/70 hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{entry.sourceTitle}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <CustomOrderBadge value={entry.status} />
                      <CustomOrderBadge value={entry.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">{entry.brand.name}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          {!selected ? (
            <div className="space-y-5">
              <div className="text-sm text-slate-500 dark:text-slate-400">Select a custom order to review details and interventions.</div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Highest-risk brands</div>
                <div className="mt-3 space-y-2">
                  {risk?.brandRisk.map((entry) => (
                    <div key={entry.brandId} className="rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
                      <div className="flex items-center justify-between gap-4"><span className="font-medium text-slate-900 dark:text-white">{entry.brandName ?? entry.brandId}</span><span className="text-xs font-semibold text-rose-600 dark:text-rose-300">Risk {entry.riskScore}</span></div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Disputes {entry.disputesOpened} • Refunds {entry.refundsInitiated} • Stale {entry.staleOrders}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CustomOrderBadge value={selected.status} />
                  <CustomOrderBadge value={selected.paymentStatus} type="payment" />
                  <CustomOrderBadge value={selected.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{selected.source.title}</h2>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Payment: {selected.paymentStatus} • Disputes: {selected.disputes.length} • Issues: {selected.issues.length}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CustomOrderMetricCard label="Measurement confirmed" value={formatDateTime(selected.measurementConfirmedAt)} helper="Buyer-approved snapshot" />
                <CustomOrderMetricCard label="Offer version" value={selected.offerVersionId} helper="Immutable pricing version" />
                <CustomOrderMetricCard label="Production deadline" value={formatDateTime(selected.promisedProductionAt)} helper={getRelativeDeadlineText(selected.promisedProductionAt)} />
                <CustomOrderMetricCard label="Delivery deadline" value={formatDateTime(selected.promisedDeliveryAt)} helper={getRelativeDeadlineText(selected.promisedDeliveryAt)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Order snapshot</div>
                  <CustomOrderKeyValueList
                    items={[
                      { label: 'Source type', value: selected.source.type },
                      { label: 'Brand', value: selected.source.brandName ?? 'Brand' },
                      { label: 'Promised dispatch', value: formatDateTime(selected.promisedDispatchAt) },
                      { label: 'Acceptance window', value: formatDateTime(selected.buyerAcceptanceWindowEndsAt) },
                      { label: 'Retention until', value: formatDateTime(selected.measurementRetentionUntil) },
                      { label: 'Anonymized at', value: formatDateTime(selected.anonymizedAt) },
                    ]}
                  />
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Internal price breakdown</div>
                  <CustomOrderJsonBreakdown data={selected.internalPriceBreakdown as Record<string, unknown> | null | undefined} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Payout allocations</div>
                  <div className="space-y-3">
                    {ledgerAllocations.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No ledger allocations linked to this order yet.</div>
                    ) : (
                      ledgerAllocations.map((allocation) => (
                        <div key={allocation.id} className="rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{allocation.allocationType.replace(/_/g, ' ')}</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {allocation.currency} {String(allocation.amount)} • {allocation.status}
                              </div>
                            </div>
                            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                              <div>Eligible {formatDateTime(allocation.eligibleAt)}</div>
                              <div>Handed off {formatDateTime(allocation.paidOutAt)}</div>
                            </div>
                          </div>
                          {allocation.payout ? (
                            <div className="mt-2 rounded-2xl bg-black/[0.03] px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                              Payout {allocation.payout.reference ?? allocation.payout.id} • {allocation.payout.status} • {allocation.payout.currency} {String(allocation.payout.amount)}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Retention hold</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Active hold: {selected.retentionHoldType ? `${selected.retentionHoldType} until ${formatDateTime(selected.retentionHoldUntil)}` : 'None'}
                  </div>
                  <select value={retentionHoldType} onChange={(event) => setRetentionHoldType(event.target.value as CustomOrderRetentionHoldType)} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    <option value="SUPPORT">Support hold</option>
                    <option value="LEGAL">Legal hold</option>
                  </select>
                  <textarea value={retentionHoldReason} onChange={(event) => setRetentionHoldReason(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Why must anonymization be blocked?" />
                  <input value={retentionHoldUntil} onChange={(event) => setRetentionHoldUntil(event.target.value)} type="datetime-local" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || retentionHoldReason.trim().length < 3}
                      onClick={() =>
                        setPendingAction({
                          title: 'Apply retention hold?',
                          description: 'This blocks measurement anonymization for the order until the hold expires or is cleared.',
                          confirmLabel: 'Apply hold',
                          execute: () =>
                            runAction(
                              () =>
                                customOrdersAdminApi.updateRetentionHold(selected.id, {
                                  clear: false,
                                  holdType: retentionHoldType,
                                  reason: retentionHoldReason.trim(),
                                  holdUntil: retentionHoldUntil ? new Date(retentionHoldUntil).toISOString() : undefined,
                                }),
                              'Retention hold updated',
                            ),
                        })
                      }
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                    >
                      Apply hold
                    </button>
                    <button
                      type="button"
                      disabled={busy || !selected.retentionHoldType}
                      onClick={() =>
                        setPendingAction({
                          title: 'Clear retention hold?',
                          description: 'This allows measurement anonymization to run again once the retention window has expired.',
                          confirmLabel: 'Clear hold',
                          execute: () => runAction(() => customOrdersAdminApi.updateRetentionHold(selected.id, { clear: true }), 'Retention hold cleared'),
                        })
                      }
                      className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                    >
                      Clear hold
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Remind brand</div>
                  <textarea value={reminderNote} onChange={(event) => setReminderNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Reminder note" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setPendingAction({
                        title: 'Send brand reminder?',
                        description: 'This will queue an operational reminder to the brand on the active custom order. Use it when a prompt follow-up is warranted.',
                        confirmLabel: 'Send reminder',
                        execute: () => runAction(() => customOrdersAdminApi.remindBrand(selected.id, reminderNote), 'Brand reminder queued'),
                      })
                    }
                    className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                  >
                    Send reminder
                  </button>
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Flag risk</div>
                  <input value={riskReason} onChange={(event) => setRiskReason(event.target.value)} placeholder="Short reason" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                  <textarea value={riskNote} onChange={(event) => setRiskNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Admin note" />
                  <button
                    type="button"
                    disabled={busy || riskReason.trim().length < 3}
                    onClick={() =>
                      setPendingAction({
                        title: 'Flag elevated order risk?',
                        description: 'This records an explicit risk signal against the order for admin follow-up and operational review.',
                        confirmLabel: 'Flag risk',
                        tone: 'danger',
                        execute: () => runAction(() => customOrdersAdminApi.flagRisk(selected.id, { reason: riskReason.trim(), note: riskNote.trim() || undefined }), 'Risk flag recorded'),
                      })
                    }
                    className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Flag risk
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Escalate refund review</div>
                <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Escalation reason" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                <textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Refund note" />
                <button
                  type="button"
                  disabled={busy || refundReason.trim().length < 3}
                  onClick={() =>
                    setPendingAction({
                      title: 'Escalate refund review?',
                      description: 'This pushes the order into refund-review handling and should be used only when the issue warrants admin intervention.',
                      confirmLabel: 'Escalate refund review',
                      tone: 'danger',
                      execute: () => runAction(() => customOrdersAdminApi.escalateRefundReview(selected.id, { reason: refundReason.trim(), note: refundNote.trim() || undefined }), 'Refund review escalated'),
                    })
                  }
                  className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  Escalate refund review
                </button>
              </div>

              <OrderMessagesPanel
                contextType="CUSTOM_ORDER"
                orderId={selected.id}
                title="Admin thread view"
                actorSurface="ADMIN"
                readOnly
              />
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Stale-order queue</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{staleOrders.length} active item(s)</div>
          </div>
          <div className="mt-4 space-y-3">
            {staleOrders.map((entry) => (
              <button key={entry.id} type="button" onClick={() => navigate(`/admin/custom-orders/${entry.customOrder.id}`)} className="w-full rounded-2xl border border-black/10 px-4 py-4 text-left dark:border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{entry.customOrder.sourceTitle}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <CustomOrderBadge value={entry.stage} type="stage" />
                      {entry.adminEscalatedAt ? <CustomOrderBadge value="ADMIN_REVIEW" type="payment" /> : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <div>Threshold {formatDateTime(entry.staleThresholdAt)}</div>
                    <div>{getRelativeDeadlineText(entry.staleThresholdAt)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Dispute queue</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {disputes.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setSelectedDisputeId(entry.id)} className={`w-full rounded-2xl border px-4 py-4 text-left ${selectedDisputeId === entry.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 dark:border-white/10'}`}>
                  <div className="font-semibold text-slate-900 dark:text-white">{entry.customOrder.sourceTitleSnapshot}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <CustomOrderBadge value={entry.status} type="payment" />
                    <CustomOrderBadge value={entry.customOrder.status} />
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              {!selectedDispute ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Select a dispute to review.</div>
              ) : (
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedDispute.customOrder.sourceTitleSnapshot}</div>
                  <select value={disputeStatus} onChange={(event) => setDisputeStatus(event.target.value as CustomOrderDisputeStatus)} className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    <option value="OPEN">Open</option>
                    <option value="BRAND_RESPONDED">Brand responded</option>
                    <option value="ADMIN_REVIEW">Admin review</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                  <select value={disputeResolution} onChange={(event) => setDisputeResolution(event.target.value as CustomOrderDisputeResolution)} className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    <option value="NO_ACTION">No action</option>
                    <option value="FULL_REFUND">Full refund</option>
                    <option value="PARTIAL_REFUND">Partial refund</option>
                    <option value="REMAKE">Remake</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>
                  <textarea value={disputeNotes} onChange={(event) => setDisputeNotes(event.target.value)} rows={4} className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Admin notes" />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setPendingAction({
                          title: 'Apply dispute decision?',
                          description: `This will set the dispute to ${disputeStatus.replace(/_/g, ' ').toLowerCase()} with a resolution of ${disputeResolution.replace(/_/g, ' ').toLowerCase()}.`,
                          confirmLabel: 'Update dispute',
                          tone: disputeResolution === 'FULL_REFUND' || disputeResolution === 'PARTIAL_REFUND' ? 'danger' : 'default',
                          execute: () => runAction(() => customOrdersAdminApi.updateDispute(selectedDispute.id, { status: disputeStatus, resolution: disputeResolution, adminNotes: disputeNotes }), 'Dispute updated'),
                        })
                      }
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                    >
                      Update dispute
                    </button>
                    <button type="button" onClick={() => navigate(`/admin/custom-orders/${selectedDispute.customOrder.id}`)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">Open order</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Fabric-rule basis moderation</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {pendingBases.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setSelectedBasisId(entry.id)} className={`w-full rounded-2xl border px-4 py-4 text-left ${selectedBasisId === entry.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 dark:border-white/10'}`}>
                  <div className="font-semibold text-slate-900 dark:text-white">{entry.label}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.measurementKeys.length} measurement key(s)</div>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              {!selectedBasis ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Select a basis to review.</div>
              ) : (
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedBasis.label}</div>
                  <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                    Keys: {selectedBasis.measurementKeys.join(', ')}
                  </div>
                  <select value={basisStatus} onChange={(event) => setBasisStatus(event.target.value as CustomFabricRuleBasisStatus)} className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    <option value="APPROVED_GLOBAL">Approve global</option>
                    <option value="BRAND_ONLY">Keep brand-only</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                  <textarea value={basisNotes} onChange={(event) => setBasisNotes(event.target.value)} rows={4} className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Moderation notes" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setPendingAction({
                        title: 'Save moderation decision?',
                        description: `This will mark the basis as ${basisStatus.replace(/_/g, ' ').toLowerCase()} and update its moderation notes for future offer authoring.`,
                        confirmLabel: 'Save decision',
                        tone: basisStatus === 'REJECTED' ? 'danger' : 'default',
                        execute: () => runAction(() => customOrdersAdminApi.reviewFabricRuleBasis(selectedBasis.id, { status: basisStatus, moderationNotes: basisNotes || undefined }), 'Fabric-rule basis reviewed'),
                      })
                    }
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                  >
                    Save decision
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Refund review queue</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {refundReviews.map((entry) => (
              <button key={entry.id} type="button" onClick={() => navigate(`/admin/custom-orders/${entry.id}`)} className="rounded-2xl border border-black/10 px-4 py-4 text-left text-sm dark:border-white/10">
                <div className="font-semibold text-slate-900 dark:text-white">{entry.sourceTitle}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <CustomOrderBadge value={entry.status} />
                  <CustomOrderBadge value={entry.paymentStatus} type="payment" />
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Issues {entry.issueCount} • Disputes {entry.disputeCount}</div>
                {entry.latestRefundEvent ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Latest refund event: {entry.latestRefundEvent.type}</div> : null}
              </button>
            ))}
          </div>
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

export default AdminCustomOrdersPage;