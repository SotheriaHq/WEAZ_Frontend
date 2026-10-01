import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import ImageWithFallback from '@/components/ImageWithFallback';
import BackLink from '@/components/ui/BackLink';
import { useReturnTo } from '@/hooks/useReturnTo';
import UniversalSelect from '@/components/forms/UniversalSelect';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';
import CustomOrderActionConfirmModal from '@/components/custom-orders/CustomOrderActionConfirmModal';
import {
  CustomOrderBadge,
  CustomOrderBuyerPaymentBreakdown,
  CustomOrderFieldTitle,
  CustomOrderJsonBreakdown,
  CustomOrderKeyValueList,
  CustomOrderMediaPreview,
  CustomOrderMetricCard,
  CustomOrderReferenceList,
  CustomOrderSection,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import {
  formatMeasurementValue,
  humanizeCustomOrderToken,
} from '@/components/custom-orders/customOrderFormatting';
import { ExtensionHistoryList } from '@/components/custom-orders/ExtensionDecisionPanel';
import { formatMeasurementLabel } from '@/utils/measurementLabels';
import {
  customOrdersAdminApi,
  type CustomOrderDetail,
  type CustomOrderLedgerAllocation,
  type CustomOrderRetentionHoldType,
  type CustomOrderTimelineEvent,
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

const isBrandReminderEvent = (event: CustomOrderTimelineEvent) => {
  const type = String(event.eventType || '').toUpperCase();
  const payload = (event.payloadJson || {}) as Record<string, unknown>;
  const reason = String(payload.reason || '').toUpperCase();
  return type === 'ADMIN_ESCALATED' && reason === 'MANUAL_BRAND_REMINDER';
};

const shortRef = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  // Never show full UUID/session-like ids in UI.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return `#${raw.slice(0, 8).toUpperCase()}`;
  }
  return raw.length > 24 ? `${raw.slice(0, 20)}…` : raw;
};

const NOT_RECORDED = 'Not recorded';

/** Who a private admin notice goes to. Never both parties in one thread. */
type NoticeAudience = 'BUYER' | 'BRAND' | 'BOTH';

const textOrFallback = (value?: string | null, fallback = NOT_RECORDED) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > 0 ? raw : fallback;
};

/** Two letters for the buyer tile when there is no profile photo. */
const initialsOf = (name?: string | null) => {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '👤';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

/**
 * The delivery address as lines, from whatever the checkout stored.
 *
 * It is a free-form JSON column, so read the keys the checkout writes
 * (`ShippingAddress` in `StoreApi`) and fall back to printing any remaining
 * string values rather than dropping an address an older order spelled
 * differently.
 */
const formatAddressLines = (address?: Record<string, unknown> | null): string[] => {
  if (!address || typeof address !== 'object') return [];
  const read = (key: string) => {
    const value = (address as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  const recipient = [read('firstName'), read('lastName')].filter(Boolean).join(' ');
  const street = [read('street'), read('apartment')].filter(Boolean).join(', ');
  const locality = [read('city'), read('state'), read('postalCode')].filter(Boolean).join(', ');
  const known = [recipient, street, locality, read('country'), read('phone')].filter(
    (line): line is string => Boolean(line && line.length > 0),
  );
  if (known.length > 0) return known;

  return Object.values(address)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
};

/**
 * The pricing engine's own numbers, read as money lines instead of as JSON.
 *
 * `internalPriceBreakdownJson` mixes three unrelated kinds of value — currency
 * amounts, enum tokens, and uuids — and the old screen rendered all of them as
 * identical grey cards, so a chart-version id looked exactly like a fabric
 * charge. These tables name each key, say what it means, and leave the uuids to
 * the references section where they belong.
 */
const PRICING_LINES: Array<{
  key: string;
  label: string;
  kind: 'money' | 'number' | 'flag';
  hint: string;
}> = [
  { key: 'baseProductionCharge', label: 'Base production charge', kind: 'money', hint: 'Labour the brand quoted, before fabric, rush and delivery.' },
  { key: 'fabricCostPerYard', label: 'Fabric cost per yard', kind: 'money', hint: 'Rate locked at checkout.' },
  { key: 'computedYards', label: 'Computed yards', kind: 'number', hint: 'Yardage the matched fabric rule derived from the measurements.' },
  { key: 'fabricComponentTotal', label: 'Fabric total', kind: 'money', hint: 'Computed yards × cost per yard.' },
  { key: 'rushFee', label: 'Rush fee', kind: 'money', hint: 'Only charged when the buyer selected rush production.' },
  { key: 'deliveryFee', label: 'Delivery fee', kind: 'money', hint: 'Shipping charged at checkout.' },
  { key: 'subtotalBeforeDelivery', label: 'Subtotal before delivery', kind: 'money', hint: 'Production + fabric + rush.' },
  { key: 'grandTotal', label: 'Engine grand total', kind: 'money', hint: 'What the engine computed. It should match the buyer paid total.' },
  { key: 'matchedRulePriority', label: 'Matched rule priority', kind: 'number', hint: 'Which fabric rule won the match.' },
  { key: 'matchedRuleFallback', label: 'Used fallback rule', kind: 'flag', hint: 'Yes means no rule matched and the fallback priced the order.' },
];

const CHART_LOCK_LINES: Array<{ key: string; label: string }> = [
  { key: 'pricingChartFamily', label: 'Pricing chart family' },
  { key: 'displayChartFamily', label: 'Display chart family' },
  { key: 'resolverPolicy', label: 'Resolver policy' },
  { key: 'computedSize', label: 'Computed size' },
  { key: 'noDirectMatch', label: 'No direct size match' },
  { key: 'conversionGuidance', label: 'Conversion guidance' },
  { key: 'quoteStatus', label: 'Quote status' },
];

/** Keys the designed tables already explain — the rest still gets shown raw. */
const EXPLAINED_BREAKDOWN_KEYS = new Set<string>([
  ...PRICING_LINES.map((line) => line.key),
  'chartLock',
  'exceptionDecision',
  'requiredMeasurementSnapshot',
  'measurementAttachmentMeta',
  'noDirectMatchAcknowledged',
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const renderFlag = (value: unknown) => (value === true ? 'Yes' : value === false ? 'No' : '—');

const AdminCustomOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  // Reachable from the custom-orders table and from the brand manage modal —
  // honour the origin that sent us here instead of always popping to the table.
  const backTarget = useReturnTo(BACK_TO_TABLE, 'Back to custom orders');

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
  const [noticeAudience, setNoticeAudience] = useState<NoticeAudience>('BUYER');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [interventionNote, setInterventionNote] = useState('');
  const [retentionHoldType, setRetentionHoldType] = useState<CustomOrderRetentionHoldType>('SUPPORT');
  const [retentionHoldReason, setRetentionHoldReason] = useState('');
  const [retentionHoldUntil, setRetentionHoldUntil] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);

  const refreshSequenceRef = useRef(0);
  const selectedSource = selected?.source ?? null;

  const brandReminders = useMemo(() => {
    const events = selected?.timelineEvents ?? [];
    return events
      .filter(isBrandReminderEvent)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [selected?.timelineEvents]);

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
      // Clear the transient inputs after a successful submit so a note isn't
      // accidentally reused on the next action. Retention-hold fields re-seed
      // from the refreshed order, so they're left to the load effect.
      setReminderNote('');
      setRiskReason('');
      setRiskNote('');
      setRefundReason('');
      setRefundNote('');
      setCancelReason('');
      setCancelNote('');
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
  /**
   * Attention says "look at this"; an intervention says "somebody owns this
   * until it is settled". A rejected or unanswered extension raises both.
   */
  const interventionOpen = Boolean(
    selected?.intervention?.isOpen ??
      (selected?.adminInterventionAt && !selected?.adminInterventionResolvedAt),
  );

  const sourceMediaUrls = useMemo(() => {
    const urls = selectedSource?.mediaUrls?.filter(Boolean) as string[] | undefined;
    if (urls && urls.length > 0) return urls;
    return selectedSource?.primaryMediaUrl ? [selectedSource.primaryMediaUrl] : [];
  }, [selectedSource]);

  const buyer = selected?.buyer ?? null;
  const payment = selected?.payment ?? null;
  const lifecycle = selected?.lifecycle ?? null;
  const currency = selected?.buyerPriceSummary?.currency || 'NGN';

  const buyerName = textOrFallback(buyer?.name, 'Unidentified buyer');
  const addressLines = useMemo(
    () => formatAddressLines(selected?.shippingAddress as Record<string, unknown> | null),
    [selected?.shippingAddress],
  );

  // The delivery contact the shopper typed is only worth a line of its own when
  // it DIFFERS from the account — otherwise it is the same fact twice.
  const checkoutContactDiffers = useMemo(() => {
    const snapshot = buyer?.checkoutContact;
    if (!snapshot) return false;
    const same = (a?: string | null, b?: string | null) =>
      String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    return (
      (Boolean(snapshot.name) && !same(snapshot.name, buyer?.name)) ||
      (Boolean(snapshot.email) && !same(snapshot.email, buyer?.email)) ||
      (Boolean(snapshot.phone) && !same(snapshot.phone, buyer?.phone))
    );
  }, [buyer?.checkoutContact, buyer?.email, buyer?.name, buyer?.phone]);

  const breakdown = useMemo(
    () => asRecord(selected?.internalPriceBreakdown),
    [selected?.internalPriceBreakdown],
  );
  const chartLockRecord = useMemo(
    () => asRecord(selected?.chartLock ?? breakdown.chartLock),
    [breakdown.chartLock, selected?.chartLock],
  );
  const unexplainedBreakdown = useMemo(() => {
    const entries = Object.entries(breakdown).filter(
      ([key]) => !EXPLAINED_BREAKDOWN_KEYS.has(key),
    );
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }, [breakdown]);

  const measurementRows = useMemo(() => {
    const snapshot = asRecord(selected?.measurementSnapshot);
    return Object.entries(snapshot)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({
        label: formatMeasurementLabel(key),
        value: formatMeasurementValue(value as number | string),
      }));
  }, [selected?.measurementSnapshot]);

  const requiredMeasurementKeys = useMemo(() => {
    const meta = asRecord(breakdown.measurementAttachmentMeta);
    const keys = meta.requiredMeasurementKeys;
    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
  }, [breakdown.measurementAttachmentMeta]);

  if (!orderId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segments={[{ label: 'Orders', path: '/admin/orders' }, { label: 'Custom order' }]}
      />

      <BackLink label={backTarget.label} to={backTarget.to} variant="pill" />

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
            onClick={() => navigate(backTarget.to)}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {backTarget.label}
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

          <section className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                  {selectedSource?.title || 'Custom order'}
                </h1>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Order {shortRef(selected.id)} • {selectedSource?.brandName || 'Brand'} • Buyer{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {buyerName}
                  </span>
                </div>
                <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                  Buyer total {formatCurrency(selected.buyerPriceSummary?.grandTotal, selected.buyerPriceSummary?.currency || 'NGN')} • Disputes {selected.disputes.length} • Issues {selected.issues.length}
                </div>
              </div>
              {sourceMediaUrls.length > 0 ? (
                <div className="w-36 shrink-0">
                  <CustomOrderMediaPreview
                    src={selectedSource?.primaryMediaUrl ?? undefined}
                    sources={sourceMediaUrls}
                    title={selectedSource?.title || 'Custom order'}
                  />
                </div>
              ) : null}
            </div>

            {/* What an admin needs before scrolling: who, when it is due to
                conclude, and whether the money landed. */}
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <CustomOrderMetricCard
                label="Buyer"
                value={buyerName}
                helper={textOrFallback(buyer?.email, 'No email on file')}
              />
              <CustomOrderMetricCard
                label={lifecycle?.completedAt ? 'Concluded' : 'Expected conclusion'}
                value={formatDateTime(lifecycle?.expectedConclusionAt)}
                helper={
                  lifecycle?.completedAt
                    ? 'Order completed'
                    : getRelativeDeadlineText(lifecycle?.expectedConclusionAt)
                }
              />
              <CustomOrderMetricCard label="Production deadline" value={formatDateTime(selected.promisedProductionAt)} helper={getRelativeDeadlineText(selected.promisedProductionAt)} />
              <CustomOrderMetricCard label="Delivery deadline" value={formatDateTime(selected.promisedDeliveryAt)} helper={getRelativeDeadlineText(selected.promisedDeliveryAt)} />
            </div>
          </section>

          {/* Buyer and delivery — open, never collapsed. This is the question the
              page is opened to answer. */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <CustomOrderFieldTitle
                title="Buyer"
                description="The account that placed this order. Name, email and phone come from the shopper's profile and fall back to what they typed at checkout."
              />
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                  {buyer?.profileImage ? (
                    <ImageWithFallback
                      src={buyer.profileImage}
                      alt={buyerName}
                      fallbackName={buyerName}
                      fit="cover"
                      rounded="none"
                      className="h-full w-full object-cover"
                      containerClassName="h-full w-full"
                    />
                  ) : (
                    <span aria-hidden="true">{initialsOf(buyer?.name)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-slate-900 dark:text-white">
                    {buyerName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {buyer?.username ? `@${buyer.username}` : 'No username on file'}
                  </div>
                </div>
                {buyer?.accountStatus ? <CustomOrderBadge value={buyer.accountStatus} /> : null}
              </div>
              <div className="mt-3">
                <CustomOrderKeyValueList
                  items={[
                    { label: 'Email', value: textOrFallback(buyer?.email) },
                    { label: 'Phone', value: textOrFallback(buyer?.phone) },
                    { label: 'Location', value: textOrFallback(buyer?.location) },
                    { label: 'Buyer since', value: formatDateTime(buyer?.joinedAt) },
                    { label: 'Buyer reference', value: shortRef(buyer?.id ?? selected.buyerId) ?? '—' },
                  ]}
                />
              </div>
              {selected.anonymizedAt ? (
                <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  This order was anonymized on {formatDateTime(selected.anonymizedAt)} — buyer
                  details may have been cleared by the retention job.
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <CustomOrderFieldTitle
                title="Delivery"
                description="Where this order ships and the contact the buyer gave at checkout. Shown only when it differs from the account on file."
              />
              <div className="mt-3 space-y-1 text-[13px] text-slate-700 dark:text-slate-200">
                {addressLines.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No delivery address was stored on this order.
                  </div>
                ) : (
                  addressLines.map((line) => (
                    <div key={line} className="break-words">
                      {line}
                    </div>
                  ))
                )}
              </div>
              {checkoutContactDiffers ? (
                <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Checkout contact
                  </div>
                  <div className="mt-2">
                    <CustomOrderKeyValueList
                      items={[
                        { label: 'Name', value: textOrFallback(buyer?.checkoutContact?.name, '—') },
                        { label: 'Email', value: textOrFallback(buyer?.checkoutContact?.email, '—') },
                        { label: 'Phone', value: textOrFallback(buyer?.checkoutContact?.phone, '—') },
                      ]}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <CustomOrderSection
            title="Transaction"
            description="The payment behind this order: what was charged, when it was posted, and whether it cleared."
            defaultOpen
            summary={
              <span className="inline-flex items-center gap-2">
                <CustomOrderBadge value={payment?.status ?? selected.paymentStatus} type="payment" />
                <span className="tabular-nums">
                  {formatCurrency(
                    payment?.amount ?? selected.buyerPriceSummary?.grandTotal,
                    payment?.currency || currency,
                  )}
                </span>
              </span>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <CustomOrderKeyValueList
                items={[
                  {
                    label: 'Amount charged',
                    value: formatCurrency(
                      payment?.amount ?? selected.buyerPriceSummary?.grandTotal,
                      payment?.currency || currency,
                    ),
                  },
                  {
                    label: 'Status',
                    value: <CustomOrderBadge value={payment?.status ?? selected.paymentStatus} type="payment" />,
                  },
                  {
                    label: 'Method',
                    value: payment?.method ? humanizeCustomOrderToken(payment.method) : NOT_RECORDED,
                  },
                  {
                    label: 'Provider',
                    value: payment?.provider ? humanizeCustomOrderToken(payment.provider) : NOT_RECORDED,
                  },
                ]}
              />
              <CustomOrderKeyValueList
                items={[
                  { label: 'Posted on', value: formatDateTime(payment?.postedAt ?? selected.createdAt) },
                  {
                    label: 'Cleared on',
                    value: payment?.confirmedAt ? formatDateTime(payment.confirmedAt) : 'Not cleared',
                  },
                  { label: 'Last verified', value: formatDateTime(payment?.lastVerifiedAt) },
                  {
                    label: 'Reference',
                    value: shortRef(payment?.reference ?? selected.paymentReference) ?? NOT_RECORDED,
                  },
                ]}
              />
            </div>

            {payment?.failureMessage ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                Last attempt failed: {payment.failureMessage}
              </p>
            ) : null}

            {payment?.attempts && payment.attempts.length > 1 ? (
              <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  All attempts ({payment.attemptCount ?? payment.attempts.length})
                </div>
                <ul className="mt-2 space-y-1.5">
                  {payment.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] px-3 py-2 text-[12px] dark:border-white/[0.06]"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {formatDateTime(attempt.createdAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <CustomOrderBadge value={attempt.status} type="payment" />
                        <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(attempt.amount, attempt.currency || currency)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CustomOrderSection>

          <CustomOrderSection
            title="Dates and milestones"
            description="Every date this order carries, in the order they happen — from the day it was placed to the day it is expected to conclude."
            defaultOpen
            summary={
              lifecycle?.completedAt
                ? 'Concluded'
                : getRelativeDeadlineText(lifecycle?.expectedConclusionAt)
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <CustomOrderKeyValueList
                items={[
                  { label: 'Order placed', value: formatDateTime(lifecycle?.placedAt ?? selected.createdAt) },
                  { label: 'Measurements confirmed', value: formatDateTime(selected.measurementConfirmedAt) },
                  { label: 'Accepted by brand', value: formatDateTime(lifecycle?.acceptedAt ?? selected.acceptedAt) },
                  { label: 'Rejected by brand', value: formatDateTime(lifecycle?.rejectedAt) },
                  { label: 'Stage entered', value: formatDateTime(lifecycle?.stageEnteredAt) },
                  { label: 'Last brand update', value: formatDateTime(lifecycle?.lastBrandProgressUpdateAt) },
                ]}
              />
              <CustomOrderKeyValueList
                items={[
                  { label: 'Promised production', value: formatDateTime(selected.promisedProductionAt) },
                  { label: 'Promised dispatch', value: formatDateTime(selected.promisedDispatchAt) },
                  { label: 'Promised delivery', value: formatDateTime(selected.promisedDeliveryAt) },
                  { label: 'Delivered', value: formatDateTime(lifecycle?.deliveredAt) },
                  { label: 'Buyer accepted', value: formatDateTime(selected.buyerAcceptedAt) },
                  {
                    label: lifecycle?.completedAt ? 'Concluded' : 'Expected conclusion',
                    value: formatDateTime(lifecycle?.expectedConclusionAt),
                  },
                ]}
              />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <CustomOrderMetricCard
                label="Production lead"
                value={
                  selected.leadTimes?.productionLeadDays != null
                    ? `${selected.leadTimes.productionLeadDays} days`
                    : '—'
                }
                helper="Locked at checkout"
              />
              <CustomOrderMetricCard
                label="Delivery window"
                value={
                  selected.leadTimes?.deliveryMinDays != null
                    ? `${selected.leadTimes.deliveryMinDays}–${selected.leadTimes.deliveryMaxDays ?? selected.leadTimes.deliveryMinDays} days`
                    : '—'
                }
                helper="Quoted range"
              />
              <CustomOrderMetricCard
                label="Rush"
                value={selected.leadTimes?.rushSelected ? 'Yes' : 'No'}
                helper={selected.leadTimes?.rushSelected ? 'Buyer paid to expedite' : 'Standard timeline'}
              />
            </div>
            {lifecycle?.issueReportedAt ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                Buyer reported an issue on {formatDateTime(lifecycle.issueReportedAt)}.
              </p>
            ) : null}
          </CustomOrderSection>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2">
                <CustomOrderFieldTitle
                  title="Order snapshot"
                  description="What was ordered and how long the buyer's measurements are kept. Dates live in their own section; technical ids live in references."
                />
              </div>
              <CustomOrderKeyValueList
                items={[
                  { label: 'Source type', value: selectedSource?.type ? humanizeCustomOrderToken(selectedSource.type) : 'Unknown' },
                  { label: 'Source', value: selectedSource?.title ?? 'Custom order' },
                  { label: 'Brand', value: selectedSource?.brandName ?? 'Brand' },
                  { label: 'Buyer total', value: formatCurrency(selected.buyerPriceSummary?.grandTotal, currency) },
                  { label: 'Acceptance window', value: formatDateTime(selected.buyerAcceptanceWindowEndsAt) },
                  { label: 'Retention until', value: formatDateTime(selected.measurementRetentionUntil) },
                  { label: 'Anonymized at', value: formatDateTime(selected.anonymizedAt) },
                ]}
              />
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <CustomOrderBuyerPaymentBreakdown
                summary={selected.buyerPriceSummary}
                formatCurrency={(value, currency) =>
                  formatCurrency(value, currency || selected.buyerPriceSummary?.currency || 'NGN')
                }
              />
            </div>
          </div>

          <CustomOrderSection
            title="Measurements on file"
            description="The buyer-approved measurement snapshot this order was priced and cut from. Cleared by the retention job unless a hold is active."
            summary={
              measurementRows.length > 0
                ? `${measurementRows.length} point${measurementRows.length === 1 ? '' : 's'}`
                : 'None stored'
            }
          >
            {measurementRows.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No measurement values are stored on this order
                {selected.anonymizedAt ? ' — it has been anonymized.' : '.'}
              </div>
            ) : (
              <>
                <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {measurementRows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {row.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {requiredMeasurementKeys.length > 0 ? (
                  <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Required by the configuration ({requiredMeasurementKeys.length})
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {requiredMeasurementKeys.map((key) => (
                        <span
                          key={key}
                          className="rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                        >
                          {formatMeasurementLabel(key)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CustomOrderSection>

          <CustomOrderSection
            title="Pricing engine and size lock"
            description="What the engine computed and which chart it was locked to. Audit material — the buyer payment breakdown above is the money that was actually charged."
            summary={selected.quoteStatus ? humanizeCustomOrderToken(selected.quoteStatus) : undefined}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Engine output
                </div>
                <div className="mt-2">
                  <CustomOrderKeyValueList
                    items={PRICING_LINES.filter((line) => breakdown[line.key] !== undefined).map(
                      (line) => ({
                        label: line.label,
                        value:
                          line.kind === 'money'
                            ? formatCurrency(Number(breakdown[line.key] ?? 0), currency)
                            : line.kind === 'flag'
                              ? renderFlag(breakdown[line.key])
                              : String(breakdown[line.key]),
                      }),
                    )}
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Size chart lock
                </div>
                <div className="mt-2">
                  <CustomOrderKeyValueList
                    items={CHART_LOCK_LINES.filter(
                      (line) => chartLockRecord[line.key] !== undefined && chartLockRecord[line.key] !== null,
                    ).map((line) => {
                      const raw = chartLockRecord[line.key];
                      return {
                        label: line.label,
                        value:
                          typeof raw === 'boolean'
                            ? renderFlag(raw)
                            : humanizeCustomOrderToken(String(raw)),
                      };
                    })}
                  />
                </div>
                {breakdown.noDirectMatchAcknowledged === true ? (
                  <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    The buyer acknowledged that no chart size matched exactly.
                  </p>
                ) : null}
              </div>
            </div>

            {selected.exceptionDecision ? (
              <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Exception decision
                </div>
                <div className="mt-2">
                  <CustomOrderJsonBreakdown
                    data={selected.exceptionDecision as Record<string, unknown>}
                  />
                </div>
              </div>
            ) : null}

            {unexplainedBreakdown ? (
              <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Other stored values
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Keys the pricing snapshot carries that this screen does not name yet — shown raw so
                  nothing is lost on audit.
                </p>
                <div className="mt-2">
                  <CustomOrderJsonBreakdown data={unexplainedBreakdown} />
                </div>
              </div>
            ) : null}
          </CustomOrderSection>

          <CustomOrderSection
            title="Delays and extensions"
            description="Every request for more time on this order, what the shopper said, and what the original promise was before any of it moved. Rush orders can never be extended."
            defaultOpen={Boolean(selected.extensionRequests.length) || interventionOpen}
            summary={
              selected.extensionPolicy
                ? selected.extensionPolicy.rushBlocked
                  ? 'Rush — no extensions'
                  : `${selected.extensionPolicy.totalExtensionDaysGranted}/${selected.extensionPolicy.maxTotalDays} days granted`
                : undefined
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <CustomOrderKeyValueList
                items={[
                  {
                    label: 'Extensions granted',
                    value: selected.extensionPolicy
                      ? `${selected.extensionPolicy.approvedExtensionCount} of ${selected.extensionPolicy.maxApprovedExtensions}`
                      : '—',
                  },
                  {
                    label: 'Days granted',
                    value: selected.extensionPolicy
                      ? `${selected.extensionPolicy.totalExtensionDaysGranted} of ${selected.extensionPolicy.maxTotalDays}`
                      : '—',
                  },
                  {
                    label: 'Can still ask for',
                    value: selected.extensionPolicy?.rushBlocked
                      ? 'Nothing — rush order'
                      : `${selected.extensionPolicy?.maxRequestableDays ?? 0} day(s)`,
                  },
                ]}
              />
              <CustomOrderKeyValueList
                items={[
                  {
                    label: 'Originally promised production',
                    value: formatDateTime(selected.originalPromisedProductionAt),
                  },
                  {
                    label: 'Originally promised delivery',
                    value: formatDateTime(selected.originalPromisedDeliveryAt),
                  },
                  {
                    label: 'Current promised delivery',
                    value: formatDateTime(selected.promisedDeliveryAt),
                  },
                ]}
              />
            </div>

            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Requests ({selected.extensionRequests.length})
              </div>
              <div className="mt-2">
                <ExtensionHistoryList requests={selected.extensionRequests} />
              </div>
            </div>
          </CustomOrderSection>

          <CustomOrderSection
            title="Intervention and private notices"
            description="Write privately to one side of this order, or each of them. The recipient reads and acknowledges — there is no reply path, and neither party sees the other's note."
            defaultOpen={interventionOpen}
            summary={interventionOpen ? 'Open' : 'None open'}
          >
            {interventionOpen ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  An intervention is open on this order
                </div>
                <div className="mt-1 text-[12px] text-rose-700/90 dark:text-rose-200/80">
                  {selected.intervention?.reason
                    ? humanizeCustomOrderToken(selected.intervention.reason)
                    : 'Admin review'}{' '}
                  · opened {formatDateTime(selected.intervention?.openedAt)}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPendingAction({
                      title: 'Close this intervention?',
                      description:
                        'Use this once the delay has actually been settled with both sides. Any open dispute stays open — a dispute is closed on the dispute.',
                      confirmLabel: 'Close intervention',
                      execute: () =>
                        runAction(
                          () =>
                            customOrdersAdminApi.resolveIntervention(selected.id, {
                              note: interventionNote.trim() || undefined,
                            }),
                          'Intervention closed',
                        ),
                    })
                  }
                  className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Close intervention
                </button>
                <textarea
                  value={interventionNote}
                  onChange={(event) => setInterventionNote(event.target.value)}
                  rows={2}
                  placeholder="Closing note (optional, internal)"
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No intervention is open on this order.
              </div>
            )}

            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <CustomOrderFieldTitle
                title="Send a private notice"
                description="Goes to the chosen party only, as a read-only note on their order screen plus a notification. Choosing both sends the SAME sentence to each — send two notices when the wording needs to differ."
              />
              <div className="mt-3 grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
                <UniversalSelect
                  value={noticeAudience}
                  onChange={(value) => setNoticeAudience(value as NoticeAudience)}
                  options={[
                    { value: 'BUYER', label: 'The shopper' },
                    { value: 'BRAND', label: 'The brand' },
                    { value: 'BOTH', label: 'Both, same wording' },
                  ]}
                />
                <textarea
                  value={noticeMessage}
                  onChange={(event) => setNoticeMessage(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="What should they know? They cannot reply to this."
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
              </div>
              <button
                type="button"
                disabled={busy || noticeMessage.trim().length < 3}
                onClick={() =>
                  setPendingAction({
                    title: 'Send this notice?',
                    description:
                      noticeAudience === 'BOTH'
                        ? 'Both the shopper and the brand receive this exact message. They cannot reply to it.'
                        : `Only ${noticeAudience === 'BUYER' ? 'the shopper' : 'the brand'} receives this. They cannot reply to it.`,
                    confirmLabel: 'Send notice',
                    execute: () =>
                      runAction(
                        () =>
                          customOrdersAdminApi.sendNotice(selected.id, {
                            audience: noticeAudience,
                            message: noticeMessage.trim(),
                          }),
                        'Notice sent',
                        { clearsAttention: false },
                      ).then((didSucceed) => {
                        if (didSucceed) setNoticeMessage('');
                        return didSucceed;
                      }),
                  })
                }
                className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
              >
                Send notice
              </button>
              <div className="mt-3">
                <CustomOrderKeyValueList
                  items={[
                    {
                      label: 'Shopper last written to',
                      value: formatDateTime(selected.notices?.buyerNoticeAt),
                    },
                    {
                      label: 'Shopper read it',
                      value: selected.notices?.buyerNoticeAckAt
                        ? formatDateTime(selected.notices.buyerNoticeAckAt)
                        : 'Not yet',
                    },
                    {
                      label: 'Brand last written to',
                      value: formatDateTime(selected.notices?.brandNoticeAt),
                    },
                    {
                      label: 'Brand read it',
                      value: selected.notices?.brandNoticeAckAt
                        ? formatDateTime(selected.notices.brandNoticeAckAt)
                        : 'Not yet',
                    },
                  ]}
                />
              </div>
            </div>
          </CustomOrderSection>

          <CustomOrderSection
            title="Payout allocations"
            description="How buyer payment is split for the brand: production advance vs final completion hold. Status shows whether each tranche is still held, payout-eligible, or paid out."
            summary={
              ledgerAllocations.length > 0
                ? `${ledgerAllocations.length} tranche${ledgerAllocations.length === 1 ? '' : 's'}`
                : 'None yet'
            }
          >
              <div className="space-y-2">
                {ledgerAllocations.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No ledger allocations linked to this order yet.</div>
                ) : (
                  ledgerAllocations.map((allocation) => {
                    const payoutLabel =
                      shortRef(allocation.payout?.reference) ||
                      (allocation.payout?.id ? shortRef(allocation.payout.id) : null);
                    return (
                    <div key={allocation.id} className="rounded-xl border border-black/10 px-3 py-2.5 text-sm dark:border-white/10">
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
                        <div className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                          Payout{payoutLabel ? ` ${payoutLabel}` : ''} • {allocation.payout.status} • {allocation.payout.currency} {String(allocation.payout.amount)}
                        </div>
                      ) : null}
                    </div>
                    );
                  })
                )}
              </div>
          </CustomOrderSection>

          <CustomOrderSection
            title="Admin actions"
            description="Everything an admin can do to this order — nudge the brand, raise a risk flag, block anonymization, escalate a refund, or cancel and refund outright. Opens by itself while the order needs attention."
            defaultOpen={needsAttention}
            summary={needsAttention ? 'Action needed' : undefined}
          >
            <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2">
                <CustomOrderFieldTitle
                  title="Retention hold"
                  description="Blocks automatic anonymization of buyer measurements. Use Support for open tickets and Legal for compliance/dispute holds. Clear the hold when the investigation is finished."
                />
              </div>
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

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <CustomOrderFieldTitle
                title="Remind brand"
                description="Sends an operational nudge to the brand owner and marks the order with an admin notice in their studio. Use when the brand needs to update production progress or respond."
              />
              <textarea value={reminderNote} onChange={(event) => setReminderNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Optional note the brand will see context for" />
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
                className="mt-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
              >
                Send reminder
              </button>

              <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Reminders already sent ({brandReminders.length})
                </div>
                {brandReminders.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    No brand reminders have been sent on this order yet.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {brandReminders.map((event) => {
                      const note = String(
                        (event.payloadJson as Record<string, unknown> | null | undefined)?.note ?? '',
                      ).trim();
                      return (
                        <li
                          key={event.id}
                          className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                        >
                          <div className="font-medium text-slate-900 dark:text-white">
                            {formatDateTime(event.createdAt)}
                          </div>
                          <div className="mt-0.5 break-words text-xs text-slate-600 dark:text-slate-300">
                            {note || 'Reminder sent (no note)'}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <CustomOrderFieldTitle
                title="Flag risk"
                description="Records an elevated risk signal and keeps the order in the admin attention queue until you resolve the underlying issue. Does not refund or cancel by itself."
              />
              <input value={riskReason} onChange={(event) => setRiskReason(event.target.value)} placeholder="Short reason (required)" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" />
              <textarea value={riskNote} onChange={(event) => setRiskNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Internal admin note (optional)" />
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
                className="mt-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Flag risk
              </button>
            </div>
            </div>

          <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <CustomOrderFieldTitle
              title="Super admin cancellation"
              description="Only for paid orders. Cancels the order and starts the full refund workflow. Irreversible money path — use when production cannot continue and the buyer must be refunded."
            />
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Cancellation reason (required)" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" />
            <textarea value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Refund note (optional)" />
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
              className="mt-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Cancel paid order
            </button>
            {selected.paymentStatus !== 'PAID' ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This action is available only while the order is still in a paid state.
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <CustomOrderFieldTitle
              title="Escalate refund review"
              description="Moves the order into refund-review handling for deeper investigation without immediately cancelling. Use when money may need to reverse but you still need more evidence."
            />
            <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Escalation reason (required)" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" />
            <textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Refund note (optional)" />
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
              className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              Escalate refund review
            </button>
          </div>
          </CustomOrderSection>

          <CustomOrderSection
            title="Technical references"
            description="The ids this order hangs off, for log searches and support threads. Shortened for reading — click to copy the full value."
          >
            <CustomOrderReferenceList
              items={[
                { label: 'Order', value: selected.references?.orderId ?? selected.id, hint: 'Custom order id.' },
                { label: 'Checkout session', value: selected.references?.checkoutSessionId, hint: 'Unified checkout session that produced this order.' },
                { label: 'Checkout intent', value: selected.references?.checkoutIntentId, hint: 'Priced intent locked before payment.' },
                { label: 'Configuration', value: selected.references?.configurationId, hint: 'The brand configuration this order was placed against.' },
                { label: 'Configuration version', value: selected.references?.configurationVersionId ?? selected.configurationVersionId, hint: 'Exact version the price was locked to.' },
                { label: 'Chart version', value: selected.references?.chartVersionId, hint: 'Size chart version used to resolve the measurements.' },
                { label: 'Fabric rule', value: selected.references?.matchedFabricRuleId, hint: 'Fabric rule that produced the yardage.' },
                { label: 'Payment reference', value: selected.references?.paymentReference ?? selected.paymentReference, hint: 'Provider reference for the charge.' },
                { label: 'Idempotency key', value: selected.references?.idempotencyKey, hint: 'Submission key that prevents duplicate orders.' },
                { label: 'Brand', value: selected.references?.brandId ?? selected.brandId, hint: 'Brand account id.' },
                { label: 'Buyer', value: selected.references?.buyerId ?? selected.buyerId, hint: 'Buyer account id.' },
              ]}
            />
          </CustomOrderSection>

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
