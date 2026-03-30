import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  customOrdersBrandApi,
  type CustomOrderDetail,
  type CustomOrderProgressStage,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { getStoreStatus } from '@/api/StoreApi';
import OrderChatDrawer from '@/components/messaging/OrderChatDrawer';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  CustomOrderBadge,
  CustomOrderDataTable,
  CustomOrderJsonBreakdown,
  CustomOrderKeyValueList,
  CustomOrderMediaPreview,
  CustomOrderWorkspaceTabs,
  formatDateTime,
} from '@/components/custom-orders/CustomOrderUi';
import {
  formatCustomOrderCode,
  formatMeasurementLabel,
  formatMeasurementValue,
  humanizeCustomOrderToken,
} from '@/components/custom-orders/customOrderFormatting';

type StudioDetailTab = 'overview' | 'measurements' | 'operations' | 'timeline';

const TABS: Array<{ id: StudioDetailTab; label: string; emoji: string; helper: string }> = [
  { id: 'overview', label: 'Overview', emoji: '🧾', helper: 'Status, summary and audit' },
  { id: 'measurements', label: 'Measurements', emoji: '📏', helper: 'Approved body points' },
  { id: 'operations', label: 'Operations', emoji: '🛠️', helper: 'Acceptance and lifecycle' },
  { id: 'timeline', label: 'Timeline', emoji: '🗓️', helper: 'Progress and order activity' },
];

const brandManagedStageOptions: Array<{
  value: CustomOrderProgressStage;
  label: string;
  helper: string;
}> = [
  {
    value: 'FABRIC_AND_PIECE_PURCHASE_GATHERING',
    label: 'Fabric and piece gathering',
    helper: 'Fabric sourcing, trims, and cut planning',
  },
  {
    value: 'DESIGN_MODE',
    label: 'Design mode',
    helper: 'Cutting, construction, and active making',
  },
  {
    value: 'FINAL_TOUCHES_AND_PACKAGING',
    label: 'Final touches and packaging',
    helper: 'Finishing, ironing, packaging, and QA',
  },
  {
    value: 'READY_FOR_DELIVERY',
    label: 'Ready for delivery',
    helper: 'Order is packed and ready for dispatch handoff',
  },
];

const stageDisplayOrder: CustomOrderProgressStage[] = [
  'ORDER_PLACED',
  'ORDER_RECEIVED',
  'FABRIC_AND_PIECE_PURCHASE_GATHERING',
  'DESIGN_MODE',
  'FINAL_TOUCHES_AND_PACKAGING',
  'READY_FOR_DELIVERY',
];

const shell = 'rounded-[1.75rem] border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const textValue = (value: unknown, fallback = '—') =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hashToTab = (hash: string): StudioDetailTab | null => {
  const key = hash.replace('#', '').trim().toLowerCase();
  if (key === 'measurements') return 'measurements';
  if (key === 'operations') return 'operations';
  if (key === 'timeline') return 'timeline';
  if (key === 'overview') return 'overview';
  return null;
};

const stageHelperMap: Record<CustomOrderProgressStage, string> = {
  ORDER_PLACED: 'System-set when the buyer completes the custom-order placement flow.',
  ORDER_RECEIVED: 'System-set after payment is confirmed and the order is accepted into production.',
  FABRIC_AND_PIECE_PURCHASE_GATHERING: 'Use this when materials, trims, and cut pieces are being prepared.',
  DESIGN_MODE: 'Use this when tailoring, stitching, and active production are underway.',
  FINAL_TOUCHES_AND_PACKAGING: 'Use this when the piece is in finishing, ironing, and packing.',
  READY_FOR_DELIVERY: 'Use this when the order is complete and ready for dispatch handoff.',
};

const lockedStatuses = new Set<CustomOrderStatus>([
  'CANCELLED_BY_BUYER_PRE_ACCEPTANCE',
  'REJECTED_BY_BRAND',
  'DELIVERY_ISSUE_REPORTED',
  'REFUND_IN_PROGRESS',
  'DISPUTED',
  'CLOSED',
  'COMPLETED',
]);

const getStageTone = (_stage: CustomOrderProgressStage, _currentStage: CustomOrderProgressStage) => '';

const StageStatusStrip: React.FC<{ currentStage: CustomOrderProgressStage }> = ({ currentStage }) => (
  <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {stageDisplayOrder.map((stage) => (
        <div
          key={stage}
          className={`min-w-[132px] rounded-2xl border px-3 py-2 ${getStageTone(stage, currentStage)}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            {stage === currentStage ? 'Current' : 'Stage'}
          </div>
          <div className="mt-1 text-sm font-semibold">{humanizeCustomOrderToken(stage)}</div>
        </div>
      ))}
    </div>
    <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
      <span className="font-semibold text-slate-900 dark:text-white">
        {humanizeCustomOrderToken(currentStage)}
      </span>{' '}
      • {stageHelperMap[currentStage]}
    </div>
  </div>
);

void stageDisplayOrder;
void getStageTone;
void StageStatusStrip;

const StudioCustomOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioDetailTab>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState('');
  const [extensionDays, setExtensionDays] = useState('2');
  const [extensionReason, setExtensionReason] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionQuote, setExceptionQuote] = useState('');
  const highlightMessageId = searchParams.get('messageId');

  const loadOrder = async (resolvedBrandId?: string | null) => {
    if (!orderId) return;
    const effectiveBrandId = resolvedBrandId ?? brandId;
    if (!effectiveBrandId) return;

    setLoading(true);
    try {
      const data = await customOrdersBrandApi.getById(effectiveBrandId, orderId);
      setOrder(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load custom order');
      navigate('/studio/custom-orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const status = await getStoreStatus();
        if (cancelled) return;
        setBrandId(status.brandId);
        await loadOrder(status.brandId);
      } catch (error: any) {
        if (!cancelled) {
          setLoading(false);
          toast.error(error?.response?.data?.message || 'Unable to load studio custom order');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    const nextTab = hashToTab(location.hash);
    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [location.hash]);

  useEffect(() => {
    const stage = order?.currentProgressStage;
    if (stage && brandManagedStageOptions.some((option) => option.value === stage)) {
      setSelectedStage(stage);
    } else {
      setSelectedStage('');
    }
  }, [order?.currentProgressStage]);

  const contactInfo = useMemo(
    () => (isRecord(order?.contactInfo) ? order.contactInfo : {}),
    [order?.contactInfo],
  );
  const shippingAddress = useMemo(
    () => (isRecord(order?.shippingAddress) ? order.shippingAddress : {}),
    [order?.shippingAddress],
  );
  const internalBreakdown = useMemo(
    () => (isRecord(order?.internalPriceBreakdown) ? order.internalPriceBreakdown : {}),
    [order?.internalPriceBreakdown],
  );
  const chartLock = useMemo(
    () => (isRecord(order?.chartLock) ? order.chartLock : null),
    [order?.chartLock],
  );
  const measurementMeta = useMemo(
    () =>
      isRecord(internalBreakdown.measurementAttachmentMeta)
        ? (internalBreakdown.measurementAttachmentMeta as Record<string, unknown>)
        : null,
    [internalBreakdown],
  );
  const technicalBreakdown = useMemo(() => {
    const filtered = { ...internalBreakdown };
    delete filtered.measurementAttachmentMeta;
    delete filtered.requiredMeasurementSnapshot;
    return filtered;
  }, [internalBreakdown]);

  const measurementEntries = useMemo(
    () => Object.entries(order?.measurementSnapshot ?? {}),
    [order?.measurementSnapshot],
  );

  const currentStage = order?.currentProgressStage ?? 'ORDER_RECEIVED';
  const currentStageLabel = humanizeCustomOrderToken(currentStage);
  const canUpdateProgressStage = Boolean(
    order &&
      brandId &&
      !lockedStatuses.has(order.status),
  );

  const measurementMetaRows = useMemo(() => {
    if (!measurementMeta) return [];
    return [
      {
        label: 'Attached at',
        value: formatDateTime(String(measurementMeta.attachedAt ?? '')) || '—',
      },
      {
        label: 'Required measurement count',
        value: textValue(measurementMeta.requiredMeasurementCount),
      },
      {
        label: 'Required measurement keys',
        value:
          Array.isArray(measurementMeta.requiredMeasurementKeys) &&
          measurementMeta.requiredMeasurementKeys.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {measurementMeta.requiredMeasurementKeys.map((key) => (
                <span
                  key={String(key)}
                  className="inline-flex rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
                >
                  {formatMeasurementLabel(String(key))}
                </span>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
    ];
  }, [measurementMeta]);

  const topSummaryRows = useMemo(
    () => [
      { label: 'Buyer', value: textValue(contactInfo.customerName) },
      { label: 'Email', value: textValue(contactInfo.email) },
      { label: 'Phone', value: textValue(contactInfo.phone) },
      { label: 'Placed', value: formatDateTime(order?.createdAt) || '—' },
    ],
    [contactInfo, order?.createdAt],
  );

  const deliveryRows = useMemo(
    () => [
      { label: 'Street', value: textValue(shippingAddress.street) },
      { label: 'City', value: textValue(shippingAddress.city) },
      { label: 'State', value: textValue(shippingAddress.state) },
      { label: 'Country', value: textValue(shippingAddress.country) },
    ],
    [shippingAddress],
  );

  const handleStageChange = async (value: string) => {
    if (!brandId || !order || !value) return;
    const nextStage = value as CustomOrderProgressStage;
    setSelectedStage(nextStage);
    setBusy(true);
    try {
      const updated = await customOrdersBrandApi.updateProgressStage(brandId, order.id, {
        stage: nextStage,
      });
      setOrder(updated);
      toast.success(`Production stage updated to ${humanizeCustomOrderToken(nextStage)}.`);
    } catch (error: any) {
      setSelectedStage(order.currentProgressStage ?? '');
      toast.error(error?.response?.data?.message || 'Unable to update production stage.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateExtensionRequest = async () => {
    if (!brandId || !order) return;
    const requestedExtraDays = Number(extensionDays);
    if (!Number.isFinite(requestedExtraDays) || requestedExtraDays < 1) {
      toast.error('Extension days must be at least 1.');
      return;
    }
    if (!extensionReason.trim()) {
      toast.error('Add a short reason for the extension request.');
      return;
    }

    setBusy(true);
    try {
      const updated = await customOrdersBrandApi.createExtensionRequest(brandId, order.id, {
        targetType: 'PRODUCTION',
        requestedExtraDays,
        reason: extensionReason.trim(),
      });
      setOrder(updated);
      setExtensionReason('');
      toast.success('Extension request sent to the buyer.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to request extension.');
    } finally {
      setBusy(false);
    }
  };

  const handleExceptionReview = async () => {
    if (!brandId || !order) return;
    if (!exceptionReason.trim()) {
      toast.error('Explain why this order needs an exception review.');
      return;
    }

    setBusy(true);
    try {
      const updated = await customOrdersBrandApi.requestExceptionReview(brandId, order.id, {
        reason: exceptionReason.trim(),
        requestedQuoteTotal: exceptionQuote.trim() || undefined,
      });
      setOrder(updated);
      setExceptionReason('');
      setExceptionQuote('');
      toast.success('Exception review request submitted.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to request exception review.');
    } finally {
      setBusy(false);
    }
  };

  // Filter out non-human-readable fields from timeline payloads
  const filterTimelinePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const skipKeys = new Set([
      'id', 'orderId', 'brandId', 'buyerId', 'userId', 'configurationId',
      'configurationVersionId', 'checkoutIntentId', 'chartVersionId', 'sourceId',
      'payoutId', 'fileId', 'mediaId', 'threadId', 'messageId', 'actorId',
    ]);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (skipKeys.has(key)) continue;
      if (typeof value === 'string' && uuidRe.test(value.trim())) continue;
      result[key] = value;
    }
    return result;
  };

  const timelineEventTone = (eventType: string): string => {
    const type = eventType.toUpperCase();
    if (type.includes('PAYMENT') || type.includes('PAID')) return 'border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10';
    if (type.includes('CANCEL') || type.includes('REJECT') || type.includes('REFUND') || type.includes('DISPUTE')) return 'border-rose-300/70 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10';
    if (type.includes('ACCEPT')) return 'border-sky-300/70 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10';
    if (type.includes('EXTENSION')) return 'border-amber-300/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
    if (type.includes('EXCEPTION')) return 'border-purple-300/70 bg-purple-50/80 dark:border-purple-500/20 dark:bg-purple-500/10';
    if (type.includes('STAGE') || type.includes('PRODUCTION')) return 'border-indigo-300/70 bg-indigo-50/80 dark:border-indigo-500/20 dark:bg-indigo-500/10';
    return 'border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]';
  };

  const renderTab = () => {
    if (!order) return null;

    if (activeTab === 'overview') {
      return (
        <div className="space-y-5">
          <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Order summary</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <CustomOrderKeyValueList
                  items={[
                    { label: 'Current production stage', value: currentStageLabel },
                    { label: 'Payment status', value: humanizeCustomOrderToken(order.paymentStatus) },
                    { label: 'Custom-order status', value: humanizeCustomOrderToken(order.status) },
                    { label: 'Brand', value: textValue(order.source.brandName, 'Brand') },
                  ]}
                />
                <CustomOrderKeyValueList
                  items={[
                    {
                      label: 'Buyer total',
                      value: formatCurrency(
                        order.buyerPriceSummary.grandTotal,
                        order.buyerPriceSummary.currency ?? 'NGN',
                      ),
                    },
                    { label: 'Production deadline', value: formatDateTime(order.promisedProductionAt) },
                    { label: 'Delivery deadline', value: formatDateTime(order.promisedDeliveryAt) },
                    { label: 'Measurements attached', value: `${measurementEntries.length}` },
                  ]}
                />
              </div>
            </section>
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Production status</div>
              <div className="mt-4 rounded-[1.5rem] border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Current display
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CustomOrderBadge value={order.status} />
                  <CustomOrderBadge value={order.paymentStatus} type="payment" />
                  <CustomOrderBadge value={currentStage} type="stage" />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Order placed and order received are system-managed. Brand production updates begin from fabric and piece gathering after payment is confirmed.
                </p>
              </div>
            </section>
          </div>

          {/* Technical breakdown merged into Overview */}
          <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_360px]">
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Price breakdown</div>
              <div className="mt-4 space-y-4">
                {technicalBreakdown && Object.keys(technicalBreakdown).length > 0 ? (
                  <CustomOrderJsonBreakdown data={technicalBreakdown} />
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No breakdown available.</div>
                )}
                {chartLock ? (
                  <CustomOrderDataTable
                    title="Chart lock"
                    rows={[
                      { label: 'Computed size', value: textValue(chartLock.computedSize) },
                      { label: 'Resolver policy', value: humanizeCustomOrderToken(chartLock.resolverPolicy) },
                      { label: 'Display chart family', value: humanizeCustomOrderToken(chartLock.displayChartFamily) },
                      { label: 'Pricing chart family', value: humanizeCustomOrderToken(chartLock.pricingChartFamily) },
                      { label: 'No direct match', value: chartLock.noDirectMatch ? 'Yes' : 'No' },
                    ].filter((row) => row.value && row.value !== '—')}
                  />
                ) : null}
              </div>
            </section>
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement meta</div>
              <div className="mt-4">
                <CustomOrderDataTable title="Attachment metadata" rows={measurementMetaRows} />
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === 'measurements') {
      return (
        <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_360px]">
          <section className={shell}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement snapshot</div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Approved buyer measurements captured for this order.
                </p>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Confirmed {formatDateTime(order.measurementConfirmedAt)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {measurementEntries.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No measurements were attached to this order.
                </div>
              ) : (
                measurementEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-[1.4rem] border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">
                      {formatMeasurementLabel(key)}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                      {formatMeasurementValue(value)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Attachment meta</div>
            <div className="mt-4">
              <CustomOrderDataTable title="Measurement attachment meta" rows={measurementMetaRows} />
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'operations') {
      return (
        <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Production management</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Delivery and settlement remain system-computed. Brand updates start from fabric and piece gathering.
            </p>

            <div className="mt-5 rounded-[1.5rem] border border-indigo-200/80 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">
                Current production status
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {currentStageLabel}
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {stageHelperMap[currentStage]}
              </p>
            </div>

            <div className="mt-5">
              <UniversalSelect
                label="Update stage"
                value={selectedStage}
                onChange={(value) => void handleStageChange(value)}
                options={brandManagedStageOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                placeholder={canUpdateProgressStage ? 'Select the next production stage' : 'Stage updates not available for this order'}
                disabled={!canUpdateProgressStage || busy}
              />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {canUpdateProgressStage
                  ? selectedStage
                    ? brandManagedStageOptions.find((option) => option.value === selectedStage)?.helper
                    : 'Choose the next production stage. Changes save immediately.'
                  : 'Stage updates are not available for this order in its current state.'}
              </p>
            </div>
          </section>

          <section className={shell}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Order actions</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.4rem] border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Accept order</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Use the production status selector on the left to advance to the next stage.
                </p>
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'timeline') {
      return (
        <div className="space-y-5">
          <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Stage history</div>
              <div className="mt-4 space-y-3">
                {order.progressEvents.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No production updates yet.</div>
                ) : (
                  order.progressEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[1.5rem] border border-indigo-200/70 bg-indigo-50/60 px-4 py-4 dark:border-indigo-500/20 dark:bg-indigo-500/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CustomOrderBadge value={event.stage} type="stage" />
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(event.changedAt)}
                        </div>
                      </div>
                      {event.note ? (
                        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{event.note}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Order activity</div>
              <div className="mt-4 space-y-3">
                {order.timelineEvents.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No timeline activity yet.</div>
                ) : (
                  order.timelineEvents.map((event) => {
                    const filteredPayload = isRecord(event.payloadJson) ? filterTimelinePayload(event.payloadJson) : null;
                    return (
                      <div
                        key={event.id}
                        className={`rounded-[1.5rem] border px-4 py-4 ${timelineEventTone(event.eventType)}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {humanizeCustomOrderToken(event.eventType)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(event.createdAt)}
                          </div>
                        </div>
                        {filteredPayload && Object.keys(filteredPayload).length > 0 ? (
                          <div className="mt-3">
                            <CustomOrderJsonBreakdown data={filteredPayload} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Extension request - moved from Operations */}
          <div className="grid gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">⏳ Request production extension</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Ask the buyer for more time if production needs it.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  value={extensionDays}
                  onChange={(event) => setExtensionDays(event.target.value)}
                  placeholder="Extra days (e.g. 3)"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
                <textarea
                  value={extensionReason}
                  onChange={(event) => setExtensionReason(event.target.value)}
                  rows={3}
                  placeholder="Why is the extension needed?"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateExtensionRequest()}
                  disabled={busy}
                  className="rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Request extension
                </button>
              </div>
            </section>

            {/* Exception review - moved from Operations */}
            <section className={shell}>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">🚨 Exception review</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Flag this order for admin review if something outside the normal flow needs resolution.
              </p>
              <div className="mt-4 space-y-3">
                <textarea
                  value={exceptionReason}
                  onChange={(event) => setExceptionReason(event.target.value)}
                  rows={3}
                  placeholder="Why does this order need exception review?"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
                <input
                  value={exceptionQuote}
                  onChange={(event) => setExceptionQuote(event.target.value)}
                  placeholder="Optional requested quote total"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => void handleExceptionReview()}
                  disabled={busy}
                  className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                >
                  Submit exception review
                </button>
              </div>
            </section>
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return <div className="px-4 py-10 text-sm text-slate-500">Loading custom order...</div>;
  }

  if (!order) {
    return <div className="px-4 py-10 text-sm text-slate-500">Custom order not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => navigate('/studio')} className="font-semibold text-slate-800 dark:text-white">
          Studio
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate('/studio/custom-orders')}
          className="font-semibold text-slate-800 dark:text-white"
        >
          Custom orders
        </button>
        <span>/</span>
        <span className="font-medium">{formatCustomOrderCode(order.id)}</span>
      </div>

      <section className="rounded-[2rem] border border-black/10 bg-white/90 p-5 shadow-[0_30px_120px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-5 min-[1180px]:grid-cols-[220px_minmax(0,1fr)_300px] min-[1180px]:items-start">
          <div className="min-w-0">
            <CustomOrderMediaPreview src={order.source.primaryMediaUrl} title={order.source.title} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CustomOrderBadge value={order.status} />
              <CustomOrderBadge value={order.paymentStatus} type="payment" />
              <CustomOrderBadge value={currentStage} type="stage" />
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {formatCustomOrderCode(order.id)}
                </div>
                <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-sm font-bold text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
                  {formatCurrency(
                    order.buyerPriceSummary.grandTotal,
                    order.buyerPriceSummary.currency ?? 'NGN',
                  )}
                </div>
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{order.source.title}</h1>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white"
              >
                Open messages
              </button>
              <button
                type="button"
                onClick={() => navigate('/studio/custom-orders')}
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                Back to queue
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className={`${shell} !p-4`}>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer details</div>
                <div className="mt-3">
                  <CustomOrderKeyValueList items={topSummaryRows} />
                </div>
              </section>
              <section className={`${shell} !p-4`}>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Delivery snapshot</div>
                <div className="mt-3">
                  <CustomOrderKeyValueList items={deliveryRows} />
                </div>
              </section>
            </div>
          </div>

          <aside className={`${shell} min-w-0`}>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Production management</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              System sets order placed and order received automatically. Brand updates begin from fabric and piece gathering.
            </p>

            <div className="mt-4 rounded-[1.4rem] border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Current production status
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <CustomOrderBadge value={currentStage} type="stage" />
                <CustomOrderBadge value={order.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {stageHelperMap[currentStage]}
              </p>
            </div>

            <div className="mt-5">
              <UniversalSelect
                label="Production status"
                value={selectedStage}
                onChange={(value) => void handleStageChange(value)}
                options={brandManagedStageOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                placeholder={canUpdateProgressStage ? 'Select the next production stage' : 'Stage updates not available in current state'}
                disabled={!canUpdateProgressStage || busy}
              />
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {canUpdateProgressStage
                  ? selectedStage
                    ? brandManagedStageOptions.find((option) => option.value === selectedStage)?.helper
                    : 'Choose the next production stage. Changes save immediately.'
                  : 'Stage updates are not available for this order in its current state.'}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {order.paymentStatus !== 'PAID' ? (
        <section className="rounded-[1.75rem] border border-amber-300/70 bg-amber-50/90 p-5 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="font-semibold">💳 Buyer payment is not complete yet</div>
          <p className="mt-2">
            Do not treat this order as production-ready until payment moves to paid.
          </p>
        </section>
      ) : null}

      <div className="max-w-full overflow-hidden">
        <CustomOrderWorkspaceTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(nextTab) => setActiveTab(nextTab as StudioDetailTab)}
        />
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">{renderTab()}</div>

      <OrderChatDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orderId={order.id}
        contextType="CUSTOM_ORDER"
        brandId={brandId}
        actorSurface="BRAND"
        customerName={textValue(contactInfo.customerName, 'Buyer')}
        highlightMessageId={highlightMessageId}
      />
    </div>
  );
};

export default StudioCustomOrderDetailPage;
