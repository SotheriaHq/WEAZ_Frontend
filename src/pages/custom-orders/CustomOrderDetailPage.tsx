import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  CustomOrderMediaPreview,
  CustomOrderMetricCard,
  CustomOrderWorkspaceTabs,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import { formatCustomOrderCode, formatMeasurementLabel, formatMeasurementValue, humanizeCustomOrderToken } from '@/components/custom-orders/customOrderFormatting';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useConfirm } from '@/components/ui/useConfirm';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const textValue = (value: unknown, fallback = '—') =>
  typeof value === 'string' && value.trim() ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : fallback;

type BuyerDetailTab = 'overview' | 'measurements' | 'timeline' | 'support' | 'technical';

const TABS: Array<{ id: BuyerDetailTab; label: string; emoji: string; helper: string }> = [
  { id: 'overview', label: 'Overview', emoji: '🧾', helper: 'Snapshot and delivery' },
  { id: 'measurements', label: 'Measurements', emoji: '📏', helper: 'Approved body points' },
  { id: 'timeline', label: 'Timeline', emoji: '🗓️', helper: 'Progress and activity' },
  { id: 'support', label: 'Support', emoji: '🤝', helper: 'Messages and actions' },
  { id: 'technical', label: 'Technical', emoji: '🧪', helper: 'Internal audit data' },
];

const hashToTab = (hash: string): BuyerDetailTab | null => {
  const key = hash.replace('#', '').trim().toLowerCase();
  if (key === 'measurements') return 'measurements';
  if (key === 'timeline') return 'timeline';
  if (key === 'support' || key === 'messages') return 'support';
  if (key === 'technical') return 'technical';
  if (key === 'overview') return 'overview';
  return null;
};

const shell = 'rounded-[1.8rem] border border-black/10 bg-white/85 p-6 dark:border-white/10 dark:bg-white/[0.04]';

const CustomOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useSelector((state: RootState) => state.user.profile);
  const [order, setOrder] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<BuyerDetailTab>('overview');
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
      if (data.paymentStatus === 'PAID') setPaymentVerification(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load custom order');
      navigate('/custom-orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrder(); }, [orderId]);
  useEffect(() => { const nextTab = hashToTab(location.hash); if (nextTab) setActiveTab(nextTab); }, [location.hash]);

  const latestOpenExtension = useMemo(() => order?.extensionRequests.find((entry) => entry.buyerResponseStatus === 'OPEN') ?? null, [order?.extensionRequests]);
  const activeDispute = useMemo(() => order?.disputes.find((entry) => entry.status !== 'CLOSED' && entry.status !== 'RESOLVED') ?? order?.disputes[0] ?? null, [order?.disputes]);
  const acceptanceWindowOpen = useMemo(() => order?.buyerAcceptanceWindowEndsAt ? new Date(order.buyerAcceptanceWindowEndsAt).getTime() >= Date.now() : false, [order?.buyerAcceptanceWindowEndsAt]);
  const canCancel = order?.status === 'DRAFT' || order?.status === 'PENDING_PAYMENT' || order?.status === 'PENDING_BRAND_ACCEPTANCE';
  const canConfirmDelivery = order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION';
  const canReportIssue = order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION' && acceptanceWindowOpen;
  const measurementEntries = Object.entries(order?.measurementSnapshot ?? {});
  const contactInfo = ((order?.contactInfo ?? null) as Record<string, unknown> | null) ?? {};
  const shippingAddress = ((order?.shippingAddress ?? null) as Record<string, unknown> | null) ?? {};

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

  const handlePayNow = async () => {
    if (!orderId || !profile?.email) return toast.error('Missing payment email for this account.');
    setBusy(true);
    try {
      const init = await customOrdersBuyerApi.initializePayment(orderId, { paymentMethod: 'PAYSTACK', email: profile.email });
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
    if (!orderId || !order?.paymentReference) return toast.error('No payment reference is attached to this custom order yet.');
    setBusy(true);
    try {
      const verificationResult = await customOrdersBuyerApi.verifyPayment(orderId, { reference: order.paymentReference, gateway: 'PAYSTACK' });
      setPaymentVerification(verificationResult);
      if (verificationResult.success) toast.success('Payment verification completed.');
      else if (verificationResult.awaitingProviderConfirmation) toast.info(verificationResult.recoveryMessage || 'Payment is still awaiting provider confirmation.');
      else toast.error(verificationResult.failureMessage || 'Payment is still pending or needs another attempt.');
      await loadOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to verify payment');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!canConfirmDelivery || !order) return;
    const approved = await confirm({ title: 'Confirm delivery?', message: 'Use this only after you have received the order and checked that it matches the agreed custom-order brief.', confirmText: 'Confirm delivery', cancelText: 'Keep reviewing' });
    if (!approved) return;
    await wrapMutation(() => customOrdersBuyerApi.confirmDelivery(order.id, deliveryNote.trim() || undefined), 'Delivery confirmed');
  };

  const handleReportIssue = async () => {
    if (!canReportIssue || issueDescription.trim().length < 10 || !order) return;
    const approved = await confirm({ title: 'Report a delivery issue?', message: 'This opens a support and dispute review path for the order.', confirmText: 'Report issue', cancelText: 'Go back', isDestructive: true });
    if (!approved) return;
    await wrapMutation(() => customOrdersBuyerApi.reportIssue(order.id, { issueType, description: issueDescription.trim() }), 'Issue reported');
  };

  const handleCancelOrder = async () => {
    if (!canCancel || cancelReason.trim().length < 3 || !order) return;
    const approved = await confirm({ title: 'Cancel this custom order?', message: 'Use this before payment confirmation only.', confirmText: 'Cancel order', cancelText: 'Keep order', isDestructive: true });
    if (!approved) return;
    await wrapMutation(() => customOrdersBuyerApi.cancel(order.id, cancelReason.trim()), 'Custom order cancelled');
  };

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">Loading custom order...</div>;
  if (!order) return <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">Custom order not found.</div>;

  const paymentNeedsProviderConfirmation = paymentVerification?.awaitingProviderConfirmation === true;

  const renderTab = () => {
    if (activeTab === 'overview') {
      return (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Order summary</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <CustomOrderKeyValueList items={[
                { label: 'Current stage', value: humanizeCustomOrderToken(order.currentProgressStage ?? 'ORDER_PLACED') },
                { label: 'Promised production', value: formatDateTime(order.promisedProductionAt) },
                { label: 'Promised dispatch', value: formatDateTime(order.promisedDispatchAt) },
                { label: 'Promised delivery', value: formatDateTime(order.promisedDeliveryAt) },
              ]} />
              <CustomOrderKeyValueList items={[
                { label: 'Locked total', value: formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency ?? 'NGN') },
                { label: 'Subtotal', value: formatCurrency(order.buyerPriceSummary.subtotal, order.buyerPriceSummary.currency ?? 'NGN') },
                { label: 'Delivery fee', value: formatCurrency(order.buyerPriceSummary.shippingFee, order.buyerPriceSummary.currency ?? 'NGN') },
                { label: 'Rush fee', value: formatCurrency(order.buyerPriceSummary.rushFee, order.buyerPriceSummary.currency ?? 'NGN') },
              ]} />
            </div>
          </section>
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Delivery and contact</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <CustomOrderKeyValueList items={[
                { label: 'Customer', value: textValue(contactInfo.customerName) },
                { label: 'Email', value: textValue(contactInfo.email) },
                { label: 'Phone', value: textValue(contactInfo.phone) },
                { label: 'Brand', value: textValue(order.source.brandName, 'Brand') },
              ]} />
              <CustomOrderKeyValueList items={[
                { label: 'Street', value: textValue(shippingAddress.street) },
                { label: 'City', value: textValue(shippingAddress.city) },
                { label: 'State', value: textValue(shippingAddress.state) },
                { label: 'Country', value: textValue(shippingAddress.country) },
              ]} />
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'measurements') {
      return (
        <section className={shell}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement snapshot</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gender labels are removed from the UI while the stored measurement contract stays intact.</p>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Confirmed {formatDateTime(order.measurementConfirmedAt)}</div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {measurementEntries.length === 0 ? <div className="text-sm text-slate-500 dark:text-slate-400">No measurement points were saved.</div> : measurementEntries.map(([key, value]) => (
              <div key={key} className="rounded-[1.5rem] border border-black/10 bg-black/[0.03] px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{formatMeasurementLabel(key)}</div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatMeasurementValue(value)}</div>
              </div>
            ))}
          </div>
          {order.chartLock ? <div className="mt-6"><CustomOrderJsonBreakdown data={order.chartLock as Record<string, unknown>} /></div> : null}
        </section>
      );
    }

    if (activeTab === 'timeline') {
      return (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Stage history</div>
            <div className="mt-4 space-y-3">{order.progressEvents.length === 0 ? <div className="text-sm text-slate-500 dark:text-slate-400">No stage history yet.</div> : order.progressEvents.map((event) => (
              <div key={event.id} className="rounded-[1.5rem] border border-black/10 px-4 py-4 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3"><CustomOrderBadge value={event.stage} type="stage" /><div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.changedAt)}</div></div>
                {event.note ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{event.note}</div> : null}
              </div>
            ))}</div>
          </section>
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Order activity</div>
            <div className="mt-4 space-y-3">{order.timelineEvents.length === 0 ? <div className="text-sm text-slate-500 dark:text-slate-400">No timeline activity yet.</div> : order.timelineEvents.map((event) => (
              <div key={event.id} className="rounded-[1.5rem] border border-black/10 px-4 py-4 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900 dark:text-white">{humanizeCustomOrderToken(event.eventType)}</div><div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.createdAt)}</div></div>
                {event.payloadJson ? <div className="mt-3"><CustomOrderJsonBreakdown data={event.payloadJson} /></div> : null}
              </div>
            ))}</div>
          </section>
        </div>
      );
    }

    if (activeTab === 'support') {
      return (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={shell}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Conversation and extension</div>
              <button type="button" onClick={() => navigate(`/messages?customOrderId=${encodeURIComponent(order.id)}`)} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Open conversation</button>
            </div>
            <div className="mt-4 space-y-3">{order.extensionRequests.length === 0 ? <div className="text-sm text-slate-500 dark:text-slate-400">No extension requests have been raised on this order.</div> : order.extensionRequests.map((request) => (
              <div key={request.id} className="rounded-[1.5rem] border border-black/10 px-4 py-4 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900 dark:text-white">{humanizeCustomOrderToken(request.targetType)} +{request.requestedExtraDays} day(s)</div><CustomOrderBadge value={request.buyerResponseStatus} type="payment" /></div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.reason}</div>
              </div>
            ))}</div>
            {latestOpenExtension ? <div className="mt-4 space-y-3 rounded-[1.5rem] border border-black/10 p-4 dark:border-white/10"><UniversalSelect value={extensionResponse} onChange={(value) => setExtensionResponse(value as CustomOrderExtensionResponseStatus)} options={[{ value: 'ACCEPTED', label: 'Accept' }, { value: 'COUNTERED', label: 'Counter' }, { value: 'REJECTED', label: 'Reject' }]} />{extensionResponse === 'COUNTERED' ? <input value={counterDays} onChange={(event) => setCounterDays(event.target.value)} placeholder="Counter days" className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" /> : null}<button type="button" disabled={busy} onClick={() => wrapMutation(() => customOrdersBuyerApi.respondToExtension(order.id, latestOpenExtension.id, { response: extensionResponse, counterDays: extensionResponse === 'COUNTERED' ? Number(counterDays) : undefined }), 'Extension response saved')} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">Send response</button></div> : null}
          </section>
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Issues and buyer actions</div>
            {activeDispute ? <div className="mt-4 rounded-[1.5rem] border border-rose-300/60 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-500/10 dark:text-rose-100"><div className="font-semibold">⚠️ Dispute is active</div><div className="mt-1">Status: {humanizeCustomOrderToken(activeDispute.status)}</div></div> : <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No active dispute on this order.</div>}
            <div className="mt-4 grid gap-4">
              <div className="rounded-[1.5rem] border border-black/10 p-4 dark:border-white/10"><div className="text-sm font-semibold text-slate-900 dark:text-white">Confirm delivery</div><textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Optional confirmation note" /><button type="button" disabled={busy || !canConfirmDelivery} onClick={() => void handleConfirmDelivery()} className="mt-3 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60">Confirm delivery</button></div>
              <div className="rounded-[1.5rem] border border-black/10 p-4 dark:border-white/10"><div className="text-sm font-semibold text-slate-900 dark:text-white">Report issue</div><div className="mt-3"><UniversalSelect value={issueType} onChange={(value) => setIssueType(value as CustomOrderIssueType)} options={[{ value: 'MEASUREMENT_NON_COMPLIANCE', label: 'Measurement non-compliance' }, { value: 'MATERIAL_DEFECT', label: 'Material defect' }, { value: 'UNFINISHED_WORK', label: 'Unfinished work' }, { value: 'NON_DELIVERY', label: 'Non-delivery' }, { value: 'UNREASONABLE_DELAY', label: 'Unreasonable delay' }, { value: 'WRONG_ITEM', label: 'Wrong item' }, { value: 'OTHER', label: 'Other' }]} /></div><textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Describe the issue" /><button type="button" disabled={busy || !canReportIssue || issueDescription.trim().length < 10} onClick={() => void handleReportIssue()} className="mt-3 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Report issue</button></div>
              <div className="rounded-[1.5rem] border border-black/10 p-4 dark:border-white/10"><div className="text-sm font-semibold text-slate-900 dark:text-white">Cancel before payment confirmation</div><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Explain the cancellation reason" /><button type="button" disabled={busy || !canCancel || cancelReason.trim().length < 3} onClick={() => void handleCancelOrder()} className="mt-3 rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white">Cancel custom order</button></div>
            </div>
          </section>
        </div>
      );
    }

    return <section className={shell}><div className="text-lg font-semibold text-slate-900 dark:text-white">Technical snapshot</div><div className="mt-4 space-y-4"><CustomOrderJsonBreakdown data={order.internalPriceBreakdown as Record<string, unknown> | null | undefined} />{order.exceptionDecision ? <CustomOrderJsonBreakdown data={order.exceptionDecision as Record<string, unknown>} /> : null}</div></section>;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {ConfirmDialog}
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => navigate('/profile')} className="font-semibold text-slate-800 dark:text-white">Profile</button>
        <span>/</span>
        <button type="button" onClick={() => navigate('/custom-orders')} className="font-semibold text-slate-800 dark:text-white">Custom orders</button>
        <span>/</span>
        <span className="font-medium">{formatCustomOrderCode(order.id)}</span>
      </div>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-6 p-6 xl:grid-cols-[360px_1fr]">
          <CustomOrderMediaPreview src={order.source.primaryMediaUrl} title={order.source.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2"><CustomOrderBadge value={order.status} /><CustomOrderBadge value={order.paymentStatus} type="payment" /><CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" /></div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{formatCustomOrderCode(order.id)}</div>
                <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{order.source.title}</h1>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Dedicated buyer workspace for this custom order. Review payment, measurements, delivery commitments, and support actions without moving through multiple pages.</p>
              </div>
              <div className="flex flex-wrap gap-3"><button type="button" onClick={() => navigate(`/messages?customOrderId=${encodeURIComponent(order.id)}`)} className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">Open conversation</button><button type="button" onClick={() => navigate('/custom-orders')} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Back to queue</button></div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CustomOrderMetricCard label="Locked total" value={formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency ?? 'NGN')} helper="Buyer-facing amount" />
              <CustomOrderMetricCard label="Production deadline" value={formatDateTime(order.promisedProductionAt)} helper={getRelativeDeadlineText(order.promisedProductionAt)} />
              <CustomOrderMetricCard label="Delivery deadline" value={formatDateTime(order.promisedDeliveryAt)} helper={getRelativeDeadlineText(order.promisedDeliveryAt)} />
              <CustomOrderMetricCard label="Measurements" value={`${measurementEntries.length}`} helper={formatDateTime(order.measurementConfirmedAt)} />
            </div>
          </div>
        </div>
      </section>

      {order.paymentStatus !== 'PAID' ? <section className="mt-6 rounded-[1.8rem] border border-amber-300/70 bg-amber-50/90 p-5 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"><div className="font-semibold">💳 Payment must complete before brand acceptance</div><p className="mt-2">{paymentNeedsProviderConfirmation ? paymentVerification?.recoveryMessage || 'Your payment attempt is waiting for provider confirmation.' : 'Initialize checkout, then verify the payment when you return from the provider.'}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={handlePayNow} disabled={busy} className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60">{busy ? 'Opening payment...' : 'Pay now'}</button><button type="button" onClick={handleVerifyPayment} disabled={busy || !order.paymentReference} className="rounded-full border border-amber-400/60 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60 dark:text-amber-100">Verify payment</button></div>{order.paymentReference ? <div className="mt-2 text-xs">Reference: {order.paymentReference}</div> : null}</section> : null}

      <div className="mt-6"><CustomOrderWorkspaceTabs tabs={TABS} activeTab={activeTab} onChange={(nextTab) => setActiveTab(nextTab as BuyerDetailTab)} /></div>
      <div className="mt-6">{renderTab()}</div>
    </div>
  );
};

export default CustomOrderDetailPage;
