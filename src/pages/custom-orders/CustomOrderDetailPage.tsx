import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import {
  customOrdersBuyerApi,
  type CustomOrderDetail,
  type CustomOrderExtensionResponseStatus,
  type CustomOrderIssueType,
  type CustomOrderPaymentVerificationResult,
} from '@/api/CustomOrderApi';
import {
  CustomOrderBadge,
  CustomOrderJsonBreakdown,
  CustomOrderKeyValueList,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import { useConfirm } from '@/components/ui/useConfirm';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const CustomOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const profile = useSelector((state: RootState) => state.user.profile);
  const [order, setOrder] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paymentVerification, setPaymentVerification] = useState<CustomOrderPaymentVerificationResult | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [issueType, setIssueType] = useState<CustomOrderIssueType>('OTHER');
  const [issueDescription, setIssueDescription] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [extensionResponse, setExtensionResponse] = useState<CustomOrderExtensionResponseStatus>('ACCEPTED');
  const [counterDays, setCounterDays] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  const loadOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = await customOrdersBuyerApi.getById(orderId);
      setOrder(data);
      if (data.paymentStatus === 'PAID') {
        setPaymentVerification(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load custom order');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  const latestOpenExtension = useMemo(
    () => order?.extensionRequests.find((entry) => entry.buyerResponseStatus === 'OPEN') ?? null,
    [order?.extensionRequests],
  );

  const activeDispute = useMemo(
    () => order?.disputes.find((entry) => entry.status !== 'CLOSED' && entry.status !== 'RESOLVED') ?? order?.disputes[0] ?? null,
    [order?.disputes],
  );
  const acceptanceWindowOpen = useMemo(() => {
    if (!order?.buyerAcceptanceWindowEndsAt) {
      return false;
    }

    return new Date(order.buyerAcceptanceWindowEndsAt).getTime() >= Date.now();
  }, [order?.buyerAcceptanceWindowEndsAt]);

  const canCancel = order?.status === 'DRAFT' || order?.status === 'PENDING_PAYMENT' || order?.status === 'PENDING_BRAND_ACCEPTANCE';
  const canConfirmDelivery = order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION';
  const canReportIssue =
    order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION' && acceptanceWindowOpen;

  const handlePayNow = async () => {
    if (!orderId || !profile?.email) {
      toast.error('Missing payment email for this account.');
      return;
    }
    setBusy(true);
    try {
      const init = await customOrdersBuyerApi.initializePayment(orderId, {
        paymentMethod: 'PAYSTACK',
        email: profile.email,
      });
      setPaymentVerification(null);
      if (init.authorizationUrl) {
        window.location.href = init.authorizationUrl;
        return;
      }
      toast.success('Payment initialized. Verify once the provider returns you here.');
      await loadOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to initialize payment');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!orderId || !order?.paymentReference) {
      toast.error('No payment reference is attached to this custom order yet.');
      return;
    }
    setBusy(true);
    try {
      const verificationResult = await customOrdersBuyerApi.verifyPayment(orderId, {
        reference: order.paymentReference,
        gateway: 'PAYSTACK',
      });
      setPaymentVerification(verificationResult);
      if (verificationResult.success) {
        toast.success('Payment verification completed.');
      } else if (verificationResult.awaitingProviderConfirmation) {
        toast.info(verificationResult.recoveryMessage || 'Payment is still awaiting provider confirmation.');
      } else {
        toast.error(verificationResult.failureMessage || 'Payment is still pending or needs another attempt.');
      }
      await loadOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to verify payment');
    } finally {
      setBusy(false);
    }
  };

  const wrapMutation = async (work: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(successMessage);
      await loadOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update custom order');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!canConfirmDelivery) {
      return;
    }

    const approved = await confirm({
      title: 'Confirm delivery?',
      message: 'Use this only after you have received the order and checked that it matches the agreed custom-order brief.',
      confirmText: 'Confirm delivery',
      cancelText: 'Keep reviewing',
    });

    if (!approved) {
      return;
    }

    await wrapMutation(() => customOrdersBuyerApi.confirmDelivery(order.id, deliveryNote.trim() || undefined), 'Delivery confirmed');
  };

  const handleReportIssue = async () => {
    const description = issueDescription.trim();
    if (!canReportIssue || description.length < 10) {
      return;
    }

    const approved = await confirm({
      title: 'Report a delivery issue?',
      message: 'This will open a support and dispute review path for the order. Make sure your issue summary is accurate before you continue.',
      confirmText: 'Report issue',
      cancelText: 'Go back',
      isDestructive: true,
    });

    if (!approved) {
      return;
    }

    await wrapMutation(
      () => customOrdersBuyerApi.reportIssue(order.id, { issueType, description }),
      'Issue reported',
    );
  };

  const handleCancelOrder = async () => {
    const reason = cancelReason.trim();
    if (!canCancel || reason.length < 3) {
      return;
    }

    const approved = await confirm({
      title: 'Cancel this custom order?',
      message: 'Use this before brand acceptance only. Cancelling now stops the current order request and can affect payment handling.',
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      isDestructive: true,
    });

    if (!approved) {
      return;
    }

    await wrapMutation(() => customOrdersBuyerApi.cancel(order.id, reason), 'Custom order cancelled');
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">Loading custom order...</div>;
  }

  if (!order) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">Custom order not found.</div>;
  }

  const paymentNeedsProviderConfirmation = paymentVerification?.awaitingProviderConfirmation === true;
  const paymentRecoveryMessage = paymentVerification?.recoveryMessage;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {ConfirmDialog}
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => navigate('/orders')} className="font-semibold text-slate-800 dark:text-white">
          Orders
        </button>
        <span>/</span>
        <span className="font-medium">Custom order #{order.id.slice(0, 8)}</span>
      </div>

      <div className="space-y-6">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <CustomOrderBadge value={order.status} />
                <CustomOrderBadge value={order.paymentStatus} type="payment" />
                <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
              </div>
              <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">{order.source.title}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {order.source.brandName ?? 'Brand'} custom order with a locked total of{' '}
                {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency ?? 'NGN')}.
              </p>
            </div>

            <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
              <CustomOrderMetricCard
                label="Production deadline"
                value={formatDateTime(order.promisedProductionAt)}
                helper={getRelativeDeadlineText(order.promisedProductionAt)}
              />
              <CustomOrderMetricCard
                label="Delivery deadline"
                value={formatDateTime(order.promisedDeliveryAt)}
                helper={getRelativeDeadlineText(order.promisedDeliveryAt)}
              />
              <CustomOrderMetricCard
                label="Acceptance window"
                value={formatDateTime(order.buyerAcceptanceWindowEndsAt)}
                helper={getRelativeDeadlineText(order.buyerAcceptanceWindowEndsAt)}
              />
              <CustomOrderMetricCard
                label="Measurement confirmed"
                value={formatDateTime(order.measurementConfirmedAt)}
                helper="This snapshot is the only measurement set sent to the brand."
              />
            </div>
          </div>

          {order.paymentStatus !== 'PAID' ? (
            <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="font-semibold">💳 Payment must complete before brand acceptance</div>
              <p className="mt-1">
                {paymentNeedsProviderConfirmation
                  ? paymentRecoveryMessage || 'Your payment attempt is waiting for provider confirmation. Retry verification after the gateway callback settles.'
                  : 'Initialize checkout, then verify the payment when you return from the provider.'}
              </p>
              {paymentNeedsProviderConfirmation ? (
                <div className="mt-2 rounded-2xl bg-amber-100/70 px-3 py-2 text-xs text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                  We have your payment reference and are waiting on provider evidence. Do not create a second payment unless the gateway shows this attempt failed.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={busy}
                  className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {busy ? 'Opening payment...' : 'Pay now'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyPayment}
                  disabled={busy || !order.paymentReference}
                  className="rounded-full border border-amber-400/60 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60 dark:text-amber-100"
                >
                  Verify payment
                </button>
              </div>
              {order.paymentReference ? <div className="mt-2 text-xs">Reference: {order.paymentReference}</div> : null}
              {paymentVerification?.failureMessage && !paymentNeedsProviderConfirmation ? (
                <div className="mt-2 text-xs">Latest verification note: {paymentVerification.failureMessage}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Order overview</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Timeline commitments</div>
                  <CustomOrderKeyValueList
                    items={[
                      { label: 'Current stage', value: order.currentProgressStage ?? 'ORDER_PLACED' },
                      { label: 'Promised production', value: formatDateTime(order.promisedProductionAt) },
                      { label: 'Promised dispatch', value: formatDateTime(order.promisedDispatchAt) },
                      { label: 'Promised delivery', value: formatDateTime(order.promisedDeliveryAt) },
                      { label: 'Acceptance window ends', value: formatDateTime(order.buyerAcceptanceWindowEndsAt) },
                    ]}
                  />
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Measurement snapshot</div>
                  <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                    {Object.entries(order.measurementSnapshot ?? {}).length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No measurement points were saved.</div>
                    ) : (
                      Object.entries(order.measurementSnapshot).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-4 rounded-2xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.03]">
                          <span>{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{String(value)} cm</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Production stage history</div>
              <div className="mt-4 space-y-3">
                {order.progressEvents.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No stage history yet.</div>
                ) : (
                  order.progressEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-black/10 px-4 py-4 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CustomOrderBadge value={event.stage} type="stage" />
                        <div className="text-xs text-slate-500 dark:text-slate-400">Entered {formatDateTime(event.changedAt)}</div>
                      </div>
                      {event.note ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{event.note}</p> : null}
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>Next SLA threshold: {formatDateTime(event.staleThresholdAt)}</div>
                        <div>Admin escalation: {formatDateTime(event.adminEscalatedAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Timeline</div>
              <div className="mt-4 space-y-3">
                {order.timelineEvents.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No timeline activity yet.</div>
                ) : (
                  order.timelineEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-black/10 px-4 py-3 dark:border-white/10">
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-medium text-slate-900 dark:text-white">{event.eventType.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.createdAt)}</div>
                      </div>
                      {event.payloadJson ? (
                        <pre className="mt-2 overflow-x-auto text-xs text-slate-500 dark:text-slate-400">{JSON.stringify(event.payloadJson, null, 2)}</pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Extension requests</div>
              <div className="mt-4 space-y-3">
                {order.extensionRequests.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No extension requests have been raised on this order.</div>
                ) : (
                  order.extensionRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-black/10 px-4 py-4 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{request.targetType} +{request.requestedExtraDays} day(s)</div>
                        <CustomOrderBadge value={request.buyerResponseStatus} type="payment" />
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.reason}</div>
                      {request.buyerCounterDays ? (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Buyer countered with {request.buyerCounterDays} day(s).</div>
                      ) : null}
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Requested {formatDateTime(request.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>

              {latestOpenExtension ? (
                <div className="mt-5 rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Respond to active extension request</div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{latestOpenExtension.reason}</p>
                  <div className="mt-4 grid gap-3">
                    <select value={extensionResponse} onChange={(event) => setExtensionResponse(event.target.value as CustomOrderExtensionResponseStatus)} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                      <option value="ACCEPTED">Accept</option>
                      <option value="COUNTERED">Counter</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                    {extensionResponse === 'COUNTERED' ? (
                      <input value={counterDays} onChange={(event) => setCounterDays(event.target.value)} placeholder="Counter days" className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        wrapMutation(
                          () =>
                            customOrdersBuyerApi.respondToExtension(order.id, latestOpenExtension.id, {
                              response: extensionResponse,
                              counterDays: extensionResponse === 'COUNTERED' ? Number(counterDays) : undefined,
                            }),
                          'Extension response saved',
                        )
                      }
                      className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
                    >
                      Send response
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Dispute and issue status</div>
              <div className="mt-4 space-y-4">
                {activeDispute ? (
                  <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-500/10 dark:text-rose-100">
                    <div className="font-semibold">⚠️ Dispute is active</div>
                    <div className="mt-1">Status: {activeDispute.status}</div>
                    {activeDispute.adminNotes ? <div className="mt-1">Admin notes: {activeDispute.adminNotes}</div> : null}
                    <div className="mt-1 text-xs">Opened {formatDateTime(activeDispute.openedAt)}</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No active dispute on this order.</div>
                )}

                {order.issues.length > 0 ? (
                  <div className="space-y-3">
                    {order.issues.map((issue) => (
                      <div key={issue.id} className="rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
                        <div className="font-semibold text-slate-900 dark:text-white">{issue.reasonType.replace(/_/g, ' ')}</div>
                        <div className="mt-1 text-slate-600 dark:text-slate-300">{issue.buyerStatement}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reported {formatDateTime(issue.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Buyer actions</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Confirm delivery</div>
                  <textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Optional confirmation note" />
                  <button type="button" disabled={busy || !canConfirmDelivery} onClick={() => void handleConfirmDelivery()} className="mt-3 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
                    Confirm delivery
                  </button>
                </div>

                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Report issue</div>
                  {!canReportIssue ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Delivery issues can only be reported while the buyer acceptance window is still open.
                    </p>
                  ) : null}
                  <select value={issueType} onChange={(event) => setIssueType(event.target.value as CustomOrderIssueType)} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
                    <option value="MEASUREMENT_NON_COMPLIANCE">Measurement non-compliance</option>
                    <option value="MATERIAL_DEFECT">Material defect</option>
                    <option value="UNFINISHED_WORK">Unfinished work</option>
                    <option value="NON_DELIVERY">Non-delivery</option>
                    <option value="UNREASONABLE_DELAY">Unreasonable delay</option>
                    <option value="WRONG_ITEM">Wrong item</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Describe the issue" />
                  <button type="button" disabled={busy || !canReportIssue || issueDescription.trim().length < 10} onClick={() => void handleReportIssue()} className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    Report issue
                  </button>
                </div>

                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Cancel before brand acceptance</div>
                  <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Explain the cancellation reason" />
                  <button type="button" disabled={busy || !canCancel || cancelReason.trim().length < 3} onClick={() => void handleCancelOrder()} className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white">
                    Cancel custom order
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Internal breakdown snapshot</div>
              <div className="mt-4">
                <CustomOrderJsonBreakdown data={order.internalPriceBreakdown as Record<string, unknown> | null | undefined} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomOrderDetailPage;