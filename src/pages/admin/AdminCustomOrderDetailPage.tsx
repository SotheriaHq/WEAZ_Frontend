import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import BackLink from '@/components/ui/BackLink';
import UniversalSelect from '@/components/forms/UniversalSelect';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';
import CustomOrderActionConfirmModal from '@/components/custom-orders/CustomOrderActionConfirmModal';
import {
  CustomOrderBadge,
  CustomOrderJsonBreakdown,
  CustomOrderKeyValueList,
  CustomOrderMediaPreview,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import {
  customOrdersAdminApi,
  type CustomOrderDetail,
  type CustomOrderLedgerAllocation,
  type CustomOrderRetentionHoldType,
} from '@/api/CustomOrderApi';

interface PendingAdminAction {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  execute: () => Promise<boolean>;
}

const BACK_TO_TABLE = '/admin/orders?tab=custom';

const formatCurrency = (amount: number | null | undefined, currency = 'NGN') => {
  const parsed = Number(amount ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
};

const attentionReasonLabel = (reason?: string | null) => {
  switch (String(reason || '').toUpperCase()) {
    case 'STALE_OPERATIONAL_STATUS':
      return 'It has been sitting without an update.';
    case 'BRAND_ACCEPTANCE_TIMEOUT':
      return 'The brand has not accepted it in time.';
    case 'STALE_STAGE':
      return 'It has been stuck at the same stage for a while.';
    case 'PAYOUT_RELEASE_ELIGIBLE':
      return 'It is ready for a manual payout release.';
    case 'DISPUTE_OPENED':
      return 'A dispute was opened on this order.';
    case 'ISSUE_REPORTED':
      return 'The buyer reported an issue.';
    case 'FLAG_RISK':
      return 'A risk flag was raised and still needs follow-up.';
    default:
      return 'This order was escalated for admin review.';
  }
};

const AdminCustomOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [selected, setSelected] = useState<CustomOrderDetail | null>(null);
  const [ledgerAllocations, setLedgerAllocations] = useState<CustomOrderLedgerAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [reminderNote, setReminderNote] = useState('');
  const [riskReason, setRiskReason] = useState('');
  const [riskNote, setRiskNote] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [retentionHoldType, setRetentionHoldType] = useState<CustomOrderRetentionHoldType>('SUPPORT');
  const [retentionHoldReason, setRetentionHoldReason] = useState('');
  const [retentionHoldUntil, setRetentionHoldUntil] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);

  const refreshSequenceRef = useRef(0);
  const selectedSource = selected?.source ?? null;

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    if (!orderId) return;
    const sequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = sequence;
    if (!options?.background) {
      setLoading(true);
    }

    // Single detail fetch includes capped ledgerAllocations — no second RTT.
    try {
      const detail = await customOrdersAdminApi.getById(orderId);
      if (refreshSequenceRef.current !== sequence) return;
      setSelected(detail);
      setLedgerAllocations(
        Array.isArray(detail?.ledgerAllocations) ? detail.ledgerAllocations : [],
      );
      setNotFound(false);
    } catch (error: any) {
      if (refreshSequenceRef.current !== sequence) return;
      if (error?.response?.status === 404) {
        setNotFound(true);
        setSelected(null);
      } else {
        toast.error(error?.response?.data?.message || 'Unable to load custom-order detail');
      }
    } finally {
      if (refreshSequenceRef.current === sequence) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Seed the retention-hold editor from the loaded order.
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

  const runAction = async (
    work: () => Promise<unknown>,
    successMessage: string,
    options?: { clearsAttention?: boolean },
  ) => {
    setBusy(true);
    try {
      await work();
      toast.success(successMessage);
      // Optimistic banner clear for resolving actions (feels instant).
      if (options?.clearsAttention !== false) {
        setSelected((prev) =>
          prev
            ? { ...prev, adminAttentionRequiredAt: null, adminAttentionReason: null }
            : prev,
        );
      }
      // Background revalidate — don't block the UI on the full detail reload.
      void refresh({ background: true });
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to complete admin action');
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

  const needsAttention = Boolean(selected?.adminAttentionRequiredAt);

  const sourceMediaUrls = useMemo(() => {
    const urls = selectedSource?.mediaUrls?.filter(Boolean) as string[] | undefined;
    if (urls && urls.length > 0) return urls;
    return selectedSource?.primaryMediaUrl ? [selectedSource.primaryMediaUrl] : [];
  }, [selectedSource]);

  if (!orderId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segments={[{ label: 'Orders', path: '/admin/orders' }, { label: 'Custom order' }]}
      />

      <BackLink label="Back to custom orders" to={BACK_TO_TABLE} variant="pill" />

      {loading && !selected ? (
        <div className="rounded-3xl border border-black/10 px-6 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Loading custom-order detail…
        </div>
      ) : notFound || !selected ? (
        <div className="rounded-3xl border border-dashed border-black/10 px-6 py-12 text-center dark:border-white/10">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            This custom order could not be found. It may have been removed or anonymized.
          </div>
          <button
            type="button"
            onClick={() => navigate(BACK_TO_TABLE)}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Back to custom orders
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Attention banner — stays until an admin takes a concrete action. */}
          {needsAttention ? (
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-rose-300/70 bg-rose-50 px-5 py-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <span className="motion-safe:animate-pulse text-2xl" aria-hidden>🚨</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-rose-700 dark:text-rose-200">
                  This order needs your attention
                </div>
                <div className="mt-0.5 text-xs text-rose-600/90 dark:text-rose-200/80">
                  {attentionReasonLabel(selected.adminAttentionReason)}{' '}
                  {String(selected.adminAttentionReason || '').toUpperCase() === 'FLAG_RISK'
                    ? 'Risk flags stay raised until you resolve the underlying issue (hold, escalate, cancel, or close a dispute).'
                    : 'The flag clears once you take a resolving action below (remind, hold, escalate, cancel, or close a dispute).'}
                </div>
              </div>
            </div>
          ) : null}

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CustomOrderBadge value={selected.status} />
                  <CustomOrderBadge value={selected.paymentStatus} type="payment" />
                  <CustomOrderBadge value={selected.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                  {needsAttention ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                      🚩 Needs review
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {selectedSource?.title || 'Custom order'}
                </h1>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  #{selected.id.slice(0, 8).toUpperCase()} • {selectedSource?.brandName || 'Brand'}
                </div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Buyer total {formatCurrency(selected.buyerPriceSummary?.grandTotal, selected.buyerPriceSummary?.currency || 'NGN')} • Disputes {selected.disputes.length} • Issues {selected.issues.length}
                </div>
              </div>
              {sourceMediaUrls.length > 0 ? (
                <div className="w-40 shrink-0">
                  <CustomOrderMediaPreview
                    src={selectedSource?.primaryMediaUrl ?? undefined}
                    sources={sourceMediaUrls}
                    title={selectedSource?.title || 'Custom order'}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CustomOrderMetricCard label="Measurement confirmed" value={formatDateTime(selected.measurementConfirmedAt)} helper="Buyer-approved snapshot" />
              <CustomOrderMetricCard label="Configuration version" value={selected.configurationVersionId} helper="Immutable pricing version" />
              <CustomOrderMetricCard label="Production deadline" value={formatDateTime(selected.promisedProductionAt)} helper={getRelativeDeadlineText(selected.promisedProductionAt)} />
              <CustomOrderMetricCard label="Delivery deadline" value={formatDateTime(selected.promisedDeliveryAt)} helper={getRelativeDeadlineText(selected.promisedDeliveryAt)} />
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Order snapshot</div>
              <CustomOrderKeyValueList
                items={[
                  { label: 'Source type', value: selectedSource?.type ?? 'Unknown' },
                  { label: 'Brand', value: selectedSource?.brandName ?? 'Brand' },
                  { label: 'Buyer total', value: formatCurrency(selected.buyerPriceSummary?.grandTotal, selected.buyerPriceSummary?.currency || 'NGN') },
                  { label: 'Promised dispatch', value: formatDateTime(selected.promisedDispatchAt) },
                  { label: 'Acceptance window', value: formatDateTime(selected.buyerAcceptanceWindowEndsAt) },
                  { label: 'Retention until', value: formatDateTime(selected.measurementRetentionUntil) },
                  { label: 'Anonymized at', value: formatDateTime(selected.anonymizedAt) },
                ]}
              />
            </div>
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Internal price breakdown</div>
              <CustomOrderJsonBreakdown data={selected.internalPriceBreakdown as Record<string, unknown> | null | undefined} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
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

            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Retention hold</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Active hold: {selected.retentionHoldType ? `${selected.retentionHoldType} until ${formatDateTime(selected.retentionHoldUntil)}` : 'None'}
              </div>
              <UniversalSelect
                value={retentionHoldType}
                onChange={(value) => setRetentionHoldType(value as CustomOrderRetentionHoldType)}
                options={[
                  { value: 'SUPPORT', label: 'Support hold' },
                  { value: 'LEGAL', label: 'Legal hold' },
                ]}
                className="mt-3"
              />
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
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
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
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
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
                    execute: () =>
                      runAction(
                        () =>
                          customOrdersAdminApi.flagRisk(selected.id, {
                            reason: riskReason.trim(),
                            note: riskNote.trim() || undefined,
                          }),
                        'Risk flag recorded',
                        { clearsAttention: false },
                      ),
                  })
                }
                className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Flag risk
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Super admin cancellation</div>
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Cancellation reason" className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
            <textarea value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Refund note" />
            <button
              type="button"
              disabled={busy || selected.paymentStatus !== 'PAID' || cancelReason.trim().length < 3}
              onClick={() =>
                setPendingAction({
                  title: 'Cancel this paid custom order?',
                  description: 'Only a super admin can use this action. It moves the order into refund handling immediately and starts the full-refund workflow.',
                  confirmLabel: 'Cancel and refund',
                  tone: 'danger',
                  execute: () => runAction(() => customOrdersAdminApi.cancelPaidOrder(selected.id, { reason: cancelReason.trim(), note: cancelNote.trim() || undefined }), 'Custom order cancelled and refund started'),
                })
              }
              className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Cancel paid order
            </button>
            {selected.paymentStatus !== 'PAID' ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This action is available only while the order is still in a paid state.
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
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

export default AdminCustomOrderDetailPage;
