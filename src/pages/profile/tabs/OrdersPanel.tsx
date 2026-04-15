import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  confirmMyOrderDelivery,
  getMyOrder,
  getMyOrders,
  type Order,
  type PaystackPaymentData,
  type ShippingAddress,
} from '@/api/StoreApi';
import { paymentApi } from '@/api/PaymentApi';
import {
  customOrdersBuyerApi,
  type CustomOrderDetail,
  type CustomOrderExtensionResponseStatus,
  type CustomOrderIssueType,
  type CustomOrderListItem,
  type CustomOrderPaymentAttempt,
  type CustomOrderPaymentVerificationResult,
  type CustomOrderProgressStage,
} from '@/api/CustomOrderApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import {
  CustomOrderBadge,
  CustomOrderDataTable,
  CustomOrderMediaPreview,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  formatCustomOrderCode,
  formatMeasurementLabel,
  formatMeasurementValue,
  humanizeCustomOrderToken,
} from '@/components/custom-orders/customOrderFormatting';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import type { RootState } from '@/store';
import PaymentDetailsSection from '@/pages/checkout/PaymentDetailsSection';
import {
  CHECKOUT_PAYMENT_OPTIONS,
  buildPaymentSubmissionData,
  createInitialPaymentState,
  setRuntimeCardholderNameMatchMode,
  type PaymentFormErrors,
  type PaymentFormState,
  validatePaymentData,
} from '@/pages/checkout/paymentFlow';
import { useConfirm } from '@/components/ui/useConfirm';
import { createIdempotencyKey } from '@/api/idempotency';
import {
  cancelActivePaystackInline,
  openPaystackInline,
} from '@/lib/paystackInline';
import {
  resolveInAppPaymentSession,
  resolvePaymentGateway,
} from '@/lib/inAppPaymentSession';

const STANDARD_STATUS_OPTIONS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED'] as const;
const CUSTOM_STATUS_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'ISSUES'] as const;

type StandardStatusFilter = (typeof STANDARD_STATUS_OPTIONS)[number];
type CustomStatusFilter = (typeof CUSTOM_STATUS_OPTIONS)[number];
type OrdersView = 'standard' | 'custom';

export type OrdersPanelSelection = {
  kind: OrdersView;
  id: string;
};

type OrdersPanelProps = {
  mode?: 'summary' | 'full';
  onViewAll?: (selection?: OrdersPanelSelection) => void;
  initialSelection?: OrdersPanelSelection | null;
  onSelectionHandled?: () => void;
};

const hasCollectedPaystackCardDraft = (
  paymentData: Pick<PaystackPaymentData, 'newCardDraft'>,
): boolean =>
  [
    paymentData.newCardDraft?.cardHolderName,
    paymentData.newCardDraft?.cardNumber,
    paymentData.newCardDraft?.expiry,
    paymentData.newCardDraft?.cvv,
  ].some((value) => String(value ?? '').trim().length > 0);

const paymentAttemptEmoji = (status: string) => {
  switch (status) {
    case 'PAID':
      return '✅';
    case 'FAILED':
      return '❌';
    case 'CANCELLED':
      return '🚫';
    case 'EXPIRED':
      return '⌛';
    case 'REQUIRES_ACTION':
      return '🧭';
    case 'PROCESSING':
      return '⏳';
    default:
      return '⏳';
  }
};

const CUSTOM_STAGE_FLOW: Array<{ value: CustomOrderProgressStage; label: string }> = [
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_RECEIVED', label: 'Order received' },
  { value: 'FABRIC_AND_PIECE_PURCHASE_GATHERING', label: 'Fabric and piece gathering' },
  { value: 'DESIGN_MODE', label: 'Design mode' },
  { value: 'FINAL_TOUCHES_AND_PACKAGING', label: 'Final touches and packaging' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for delivery' },
];

const BUYER_STAGE_FLOW: Array<{ value: CustomOrderProgressStage; label: string }> = [
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'FABRIC_AND_PIECE_PURCHASE_GATHERING', label: 'Fabric and piece gathering' },
  { value: 'DESIGN_MODE', label: 'Design mode' },
  { value: 'FINAL_TOUCHES_AND_PACKAGING', label: 'Final touches and packaging' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for delivery' },
];

const BUYER_TIMELINE_TAB_TONES = [
  {
    completed: 'border-emerald-300/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100',
    current: 'border-sky-300/80 bg-sky-50/80 text-sky-900 ring-2 ring-sky-200/70 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/30',
  },
  {
    completed: 'border-cyan-300/80 bg-cyan-50/80 text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-100',
    current: 'border-cyan-300/80 bg-cyan-50/80 text-cyan-900 ring-2 ring-cyan-200/70 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-100 dark:ring-cyan-500/30',
  },
  {
    completed: 'border-indigo-300/80 bg-indigo-50/80 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100',
    current: 'border-indigo-300/80 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-200/70 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-500/30',
  },
  {
    completed: 'border-amber-300/80 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100',
    current: 'border-amber-300/80 bg-amber-50/80 text-amber-900 ring-2 ring-amber-200/70 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  },
  {
    completed: 'border-violet-300/80 bg-violet-50/80 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100',
    current: 'border-violet-300/80 bg-violet-50/80 text-violet-900 ring-2 ring-violet-200/70 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100 dark:ring-violet-500/30',
  },
] as const;

const normalizeStatus = (value: string | undefined): string => {
  if (!value) return 'UNKNOWN';
  return value.trim().toUpperCase().replace(/\s+/g, '_');
};

const formatCurrency = (amount: number, currency: string): string => {
  const safeCurrency = currency && currency.length === 3 ? currency : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  } catch {
    return `${safeCurrency} ${amount ?? 0}`;
  }
};

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(parsed);
};

const formatDateTimeValue = (value?: string | null): string => {
  if (!value) return 'Recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recorded';
  return parsed.toLocaleString();
};

const textValue = (value: unknown, fallback = 'Not provided'): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const statusBadgeClass = (status: string): string => {
  if (status === 'DELIVERED') return 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300';
  if (status === 'SHIPPED') return 'text-blue-600 bg-blue-500/10 dark:text-blue-300';
  if (status === 'CANCELLED') return 'text-rose-600 bg-rose-500/10 dark:text-rose-300';
  if (status === 'PROCESSING') return 'text-amber-600 bg-amber-500/10 dark:text-amber-300';
  return 'text-gray-600 bg-gray-400/10 dark:text-gray-300';
};

const progressSegments = (status: string): number => {
  if (status === 'PENDING') return 1;
  if (status === 'PROCESSING') return 2;
  if (status === 'SHIPPED') return 3;
  if (status === 'DELIVERED') return 4;
  return 0;
};

const customStatusBucket = (status: string | undefined): CustomStatusFilter => {
  switch (normalizeStatus(status)) {
    case 'DRAFT':
    case 'PENDING_PAYMENT':
    case 'PENDING_BRAND_ACCEPTANCE':
      return 'PENDING';
    case 'ACCEPTED':
    case 'IN_PRODUCTION':
    case 'READY_FOR_DISPATCH':
    case 'IN_TRANSIT':
    case 'DELIVERED_PENDING_BUYER_CONFIRMATION':
      return 'ACTIVE';
    case 'COMPLETED':
    case 'CLOSED':
      return 'COMPLETED';
    default:
      return 'ISSUES';
  }
};

const standardOrderSummarySearchText = (order: Order) =>
  [
    order.id,
    order.customerName,
    order.brand?.name,
    ...(Array.isArray(order.items) ? order.items.map((item) => item.name) : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const customOrderSummarySearchText = (order: CustomOrderListItem) =>
  [
    order.id,
    order.sourceTitle,
    order.brand?.name,
    order.buyer?.name,
    order.delivery?.city,
    order.delivery?.state,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getBuyerFacingProgressStage = (
  stage?: CustomOrderProgressStage | null,
): CustomOrderProgressStage => {
  if (!stage || stage === 'ORDER_RECEIVED') return 'ORDER_PLACED';
  return stage;
};

const getBuyerFacingProgressLabel = (stage?: CustomOrderProgressStage | null) =>
  CUSTOM_STAGE_FLOW.find((item) => item.value === getBuyerFacingProgressStage(stage))?.label ??
  'Order placed';

const shouldShowBuyerStatusBadge = (status?: string | null) => {
  const normalized = normalizeStatus(status ?? undefined);
  return new Set([
    'COMPLETED',
    'CLOSED',
    'DISPUTED',
    'DELIVERY_ISSUE_REPORTED',
    'REFUND_IN_PROGRESS',
    'REJECTED_BY_BRAND',
    'CANCELLED_BY_BUYER_PRE_ACCEPTANCE',
  ]).has(normalized);
};

const getBuyerCustomStageStepIndex = (stage?: CustomOrderProgressStage | null) =>
  BUYER_STAGE_FLOW.findIndex((item) => item.value === getBuyerFacingProgressStage(stage));

const getBuyerCustomHeadline = (stage?: CustomOrderProgressStage | null) => {
  switch (getBuyerFacingProgressStage(stage)) {
    case 'FABRIC_AND_PIECE_PURCHASE_GATHERING':
      return 'The brand is gathering fabric and pattern pieces';
    case 'DESIGN_MODE':
      return 'Your custom order is in design mode';
    case 'FINAL_TOUCHES_AND_PACKAGING':
      return 'The brand is finishing and packaging your order';
    case 'READY_FOR_DELIVERY':
      return 'Your custom order is ready for delivery';
    default:
      return 'Your custom order has been placed';
  }
};

const getBuyerCustomDescription = (stage?: CustomOrderProgressStage | null) => {
  switch (getBuyerFacingProgressStage(stage)) {
    case 'FABRIC_AND_PIECE_PURCHASE_GATHERING':
      return 'The brand has moved into sourcing and preparation for your custom piece.';
    case 'DESIGN_MODE':
      return 'Construction and design work are now underway on this order.';
    case 'FINAL_TOUCHES_AND_PACKAGING':
      return 'The brand is wrapping up finishing details before dispatch.';
    case 'READY_FOR_DELIVERY':
      return 'The order is complete on the brand side and waiting for delivery handoff.';
    default:
      return 'Payment is complete and your custom order is now active in the brand workspace.';
  }
};

const BuyerCustomStageFiller: React.FC<{
  stage?: CustomOrderProgressStage | null;
  brandName?: string | null;
  compact?: boolean;
  statusLabel?: string | null;
  progressIndex?: number | null;
}> = ({ stage, brandName, compact = false, statusLabel = null, progressIndex = null }) => {
  const effectiveStage = getBuyerFacingProgressStage(stage);
  const stepIndex =
    typeof progressIndex === 'number' ? progressIndex : getBuyerCustomStageStepIndex(effectiveStage);
  const resolvedLabel = statusLabel ?? getBuyerFacingProgressLabel(effectiveStage);

  return (
    <div
      className={`rounded-2xl border border-sky-200/80 bg-sky-50/80 dark:border-sky-800/30 dark:bg-sky-500/10 ${
        compact ? 'px-4 py-3' : 'px-4 py-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">
            Current status
          </div>
          <div className={`${compact ? 'mt-1 text-base' : 'mt-1 text-lg'} font-bold text-slate-900 dark:text-white`}>
            {resolvedLabel}
          </div>
        </div>
        {brandName ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">{brandName}</div>
        ) : null}
      </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {BUYER_STAGE_FLOW.map((step, index) => {
            const active = index <= stepIndex;
          return (
            <span
              key={step.value}
              className={`h-2.5 rounded-full transition-colors ${
                active ? 'bg-sky-500 dark:bg-sky-300' : 'bg-slate-200 dark:bg-white/10'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

const getStandardOrderHeadline = (order: Order) => {
  if (order.buyerConfirmedDeliveryAt) return 'You have confirmed receipt of this order';
  switch (order.status) {
    case 'SHIPPED':
      return 'Your order is on the way';
    case 'DELIVERED':
      return 'Your order has been delivered';
    case 'PROCESSING':
      return 'The brand is preparing your order';
    case 'CANCELLED':
      return 'This order was cancelled';
    default:
      return 'Your order has been placed';
  }
};

const getStandardOrderDescription = (order: Order) => {
  if (order.buyerConfirmedDeliveryAt) {
    return `Receipt confirmed on ${formatDateTimeValue(order.buyerConfirmedDeliveryAt)}.`;
  }
  switch (order.status) {
    case 'SHIPPED':
      return 'The brand has shipped this order. Confirm receipt when your package reaches you.';
    case 'DELIVERED':
      return 'The brand marked this order delivered. Confirm receipt if the package has reached you.';
    case 'PROCESSING':
      return 'Payment is complete and the brand is preparing your order before dispatch.';
    case 'CANCELLED':
      return 'This order is no longer active.';
    default:
      return 'Track each fulfillment step here without leaving your profile workspace.';
  }
};

const getStandardTimelineSteps = (order: Order) => {
  const isProcessingOrLater = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(order.status);
  const isShippedOrLater = ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(order.status);
  const isDeliveredOrLater = ['DELIVERED', 'RETURNED'].includes(order.status);

  return [
    {
      key: 'placed',
      label: 'Order placed',
      detail: 'Your purchase was created successfully.',
      complete: true,
      time: order.createdAt,
    },
    {
      key: 'paid',
      label: order.paymentStatus === 'PAID' ? 'Payment confirmed' : 'Payment pending',
      detail:
        order.paymentStatus === 'PAID'
          ? 'Payment has been confirmed for this order.'
          : 'Payment still needs to be completed before fulfillment continues.',
      complete: order.paymentStatus === 'PAID',
      current: order.paymentStatus !== 'PAID',
      time: order.paidAt,
    },
    {
      key: 'processing',
      label: 'Brand preparing order',
      detail: 'The brand is getting your order ready before dispatch.',
      complete: isProcessingOrLater,
      current: order.status === 'PROCESSING',
      time: order.status === 'PROCESSING' ? order.updatedAt : null,
    },
    {
      key: 'shipped',
      label: 'Order shipped',
      detail: 'Your package has been dispatched and is in transit.',
      complete: isShippedOrLater,
      current: order.status === 'SHIPPED' && !order.buyerConfirmedDeliveryAt,
      time: order.status === 'SHIPPED' ? order.updatedAt : null,
    },
    {
      key: 'confirmed',
      label: 'Delivered and confirmed',
      detail: order.buyerConfirmedDeliveryAt
        ? 'You confirmed receipt of this order.'
        : 'Confirm delivery once you receive your package to complete the order.',
      complete: Boolean(order.buyerConfirmedDeliveryAt) || isDeliveredOrLater,
      current: order.status === 'SHIPPED' && !order.buyerConfirmedDeliveryAt,
      time: order.buyerConfirmedDeliveryAt || order.deliveredAt,
    },
  ];
};

const StandardOrderDetailView: React.FC<{ orderId: string; onBack: () => void }> = ({
  orderId,
  onBack,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const data = await getMyOrder(orderId);
        if (!mounted) return;
        setOrder(data as Order);
      } catch (error) {
        if (!mounted) return;
        setOrder(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirmingDelivery(true);
    try {
      const updated = await confirmMyOrderDelivery(order.id);
      setOrder(updated as Order);
      toast.success('Delivery confirmed.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to confirm delivery.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-gray-200/70 bg-white/70 p-8 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-300">
        Unable to load this order inside the profile workspace.
      </div>
    );
  }

  const firstItem = order.items?.[0] ?? null;
  const canConfirmDelivery =
    (order.status === 'SHIPPED' || order.status === 'DELIVERED') &&
    order.paymentStatus === 'PAID' &&
    !order.buyerConfirmedDeliveryAt;
  const timelineSteps = getStandardTimelineSteps(order);
  const receiptSubtotal =
    order.financeBreakdown?.itemSubtotal ??
    (order.items ?? []).reduce(
      (sum, item) => sum + Number(item.price ?? item.unitPrice ?? 0) * item.quantity,
      0,
    );
  const receiptShipping =
    order.financeBreakdown?.shippingAmount ?? Number(order.shippingCost || 0);
  const receiptDiscount =
    order.financeBreakdown?.discountAmount ?? Number(order.discountAmount || 0);
  const receiptTotal =
    order.financeBreakdown?.grossAmount ?? Number(order.totalAmount || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white"
        >
          Back to orders
        </button>
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Standard order
        </div>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-gray-200/80 bg-white/70 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <div className="grid gap-6 p-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="aspect-square overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10">
            {firstItem?.thumbnail ? (
              <ImageWithFallback
                src={firstItem.thumbnail}
                alt={firstItem.name}
                fit="contain"
                rounded="none"
                className="h-full w-full"
                containerClassName="h-full w-full overflow-hidden"
                maxHeightClassName="max-h-[85vh]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500">
                No image
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(normalizeStatus(order.status))}`}>
                  {normalizeStatus(order.status)}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  {getStandardOrderHeadline(order)}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {getStandardOrderDescription(order)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(Number(order.totalAmount), order.currency || 'NGN')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoPill label="Brand" value={order.brand?.name || 'Brand'} />
              <InfoPill label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} mono />
              <InfoPill label="Placed" value={formatDateTimeValue(order.createdAt)} />
              <InfoPill label="Latest update" value={formatDateTimeValue(order.updatedAt)} />
            </div>

            {canConfirmDelivery ? (
              <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                <p className="font-semibold">Have you received your package?</p>
                <p className="mt-1">
                  Confirm receipt once the order reaches you to complete the order.
                </p>
                <button
                  type="button"
                  onClick={() => void handleConfirmDelivery()}
                  disabled={confirmingDelivery}
                  className="mt-3 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmingDelivery ? 'Confirming...' : 'Delivered and confirmed'}
                </button>
              </div>
            ) : null}

            {order.buyerConfirmedDeliveryAt ? (
              <div className="rounded-2xl border border-sky-300/70 bg-sky-50/80 px-4 py-4 text-sm text-sky-900 dark:border-sky-800/40 dark:bg-sky-500/10 dark:text-sky-100">
                You confirmed this order on {formatDateTimeValue(order.buyerConfirmedDeliveryAt)}.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Order progress</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Every fulfillment stage appears here so you know exactly what is happening.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {timelineSteps.map((step) => {
            const stateTone = step.complete
              ? 'border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
              : step.current
                ? 'border-blue-300/70 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10'
                : 'border-gray-200 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.03]';

            return (
              <div key={step.key} className={`rounded-2xl border p-4 ${stateTone}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{step.detail}</p>
                {step.time ? (
                  <p className="mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {formatDateTimeValue(step.time)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Order items and receipt</h3>
        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <div
              key={`${item.productId}-${item.name}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200/70 px-4 py-4 text-sm dark:border-gray-800/80"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10">
                  {item.thumbnail ? (
                    <ImageWithFallback
                      src={item.thumbnail}
                      alt={item.name}
                      className="h-full w-full"
                      containerClassName="h-full w-full"
                      fit="contain"
                      rounded="none"
                      maxHeightClassName="max-h-[85vh]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                  <div className="flex flex-wrap gap-2 text-gray-500 dark:text-gray-400">
                    {item.selectedSize ? <span>Size: {item.selectedSize}</span> : null}
                    {item.selectedColor ? <span>Color: {item.selectedColor}</span> : null}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500 dark:text-gray-400">Qty {item.quantity}</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(
                    Number(item.price ?? item.unitPrice ?? 0) * item.quantity,
                    order.currency || 'NGN',
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-gray-200/70 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <ReceiptRow
            label="Items subtotal"
            value={formatCurrency(receiptSubtotal, order.currency || 'NGN')}
          />
          <ReceiptRow
            label="Shipping"
            value={formatCurrency(receiptShipping, order.currency || 'NGN')}
          />
          <ReceiptRow
            label="Discount"
            value={
              receiptDiscount > 0
                ? `- ${formatCurrency(receiptDiscount, order.currency || 'NGN')}`
                : formatCurrency(receiptDiscount, order.currency || 'NGN')
            }
          />
          <ReceiptRow
            label="Grand total"
            value={formatCurrency(receiptTotal, order.currency || 'NGN')}
            strong
          />
        </div>
      </section>
    </div>
  );
};

export const BuyerCustomOrderDetailView: React.FC<{
  orderId: string;
  onBack: () => void;
  previewOrder?: CustomOrderListItem | null;
}> = ({ orderId, onBack, previewOrder = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useSelector((state: RootState) => state.user.profile);
  const [order, setOrder] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paymentVerification, setPaymentVerification] =
    useState<CustomOrderPaymentVerificationResult | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<keyof PaymentFormState>('PAYSTACK');
  const [paymentState, setPaymentState] = useState(() =>
    createInitialPaymentState(profile?.email ?? '', profile?.phoneNumber ?? ''),
  );
  const [paymentErrors, setPaymentErrors] = useState<PaymentFormErrors>({});
  const [paymentGateway, setPaymentGateway] = useState<string>('PAYSTACK');
  const [paymentActionMessage, setPaymentActionMessage] = useState<string | null>(null);
  const [paymentAttempts, setPaymentAttempts] = useState<CustomOrderPaymentAttempt[]>([]);
  const [paymentAttemptsLoading, setPaymentAttemptsLoading] = useState(false);
  const [issueType, setIssueType] = useState<CustomOrderIssueType>('OTHER');
  const [issueDescription, setIssueDescription] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [extensionResponse, setExtensionResponse] =
    useState<CustomOrderExtensionResponseStatus>('ACCEPTED');
  const [counterDays, setCounterDays] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();
  const paymentInitIdempotencyKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const refreshPaymentAttempts = useCallback(async () => {
    if (!orderId) return;
    setPaymentAttemptsLoading(true);
    try {
      const attempts = await customOrdersBuyerApi.listPaymentAttempts(orderId);
      if (mountedRef.current) {
        setPaymentAttempts(attempts);
      }
    } catch {
      if (mountedRef.current) {
        setPaymentAttempts([]);
      }
    } finally {
      if (mountedRef.current) {
        setPaymentAttemptsLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void paymentApi
      .getPolicy()
      .then((policy) => {
        if (!active) {
          return;
        }

        setRuntimeCardholderNameMatchMode(policy.paystack.cardholderNameMatchMode);
      })
      .catch(() => {
        if (active) {
          setRuntimeCardholderNameMatchMode(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const paymentFailureReason =
      (location.state as { paymentFailureReason?: string } | null)
        ?.paymentFailureReason;
    if (paymentFailureReason) {
      toast.error(paymentFailureReason);
    }
  }, [location.state]);

  useEffect(() => {
    return () => {
      void cancelActivePaystackInline();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const data = await customOrdersBuyerApi.getById(orderId);
        if (!mounted) return;
        setOrder(data);
        if (data.paymentStatus === 'PAID') {
          setPaymentVerification(null);
        }
      } catch (error: any) {
        if (!mounted) return;
        setOrder(null);
        toast.error(error?.response?.data?.message || 'Unable to load custom order');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const latestOpenExtension = useMemo(
    () =>
      order?.extensionRequests.find(
        (entry) => entry.buyerResponseStatus === 'OPEN',
      ) ?? null,
    [order?.extensionRequests],
  );
  const activeDispute = useMemo(
    () =>
      order?.disputes.find(
        (entry) => entry.status !== 'CLOSED' && entry.status !== 'RESOLVED',
      ) ??
      order?.disputes[0] ??
      null,
    [order?.disputes],
  );
  const acceptanceWindowOpen = useMemo(
    () =>
      order?.buyerAcceptanceWindowEndsAt
        ? new Date(order.buyerAcceptanceWindowEndsAt).getTime() >= Date.now()
        : false,
    [order?.buyerAcceptanceWindowEndsAt],
  );
  const canConfirmDelivery =
    order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION';
  const canReportIssue =
    order?.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION' &&
    acceptanceWindowOpen;
  const contactInfo = (order?.contactInfo as Record<string, unknown> | undefined) ?? {};
  const shippingAddress =
    (order?.shippingAddress as Record<string, unknown> | undefined) ?? {};
  const paymentShippingAddress = useMemo<ShippingAddress>(
    () => ({
      firstName:
        String(contactInfo.customerName || profile?.firstName || '').split(' ')[0] ||
        profile?.firstName ||
        'Buyer',
      lastName:
        String(contactInfo.customerName || profile?.lastName || '')
          .split(' ')
          .slice(1)
          .join(' ') ||
        profile?.lastName ||
        'Customer',
      street: String(shippingAddress.street ?? ''),
      apartment: String(shippingAddress.apartment ?? ''),
      city: String(shippingAddress.city ?? ''),
      state: String(shippingAddress.state ?? ''),
      postalCode: String(shippingAddress.postalCode ?? ''),
      country: String(shippingAddress.country ?? 'Nigeria'),
      phone: String(contactInfo.phone ?? profile?.phoneNumber ?? ''),
    }),
    [
      contactInfo.customerName,
      contactInfo.phone,
      profile?.firstName,
      profile?.lastName,
      profile?.phoneNumber,
      shippingAddress.apartment,
      shippingAddress.city,
      shippingAddress.country,
      shippingAddress.postalCode,
      shippingAddress.state,
      shippingAddress.street,
    ],
  );
  const activePaymentData = paymentState[paymentMethod];
  const isHostedNewCardSelection =
    paymentMethod === 'PAYSTACK' &&
    activePaymentData.channel === 'CARD' &&
    !activePaymentData.useSavedCard &&
    !hasCollectedPaystackCardDraft(activePaymentData);

  useEffect(() => {
    setPaymentState((prev) => ({
      PAYSTACK: {
        ...prev.PAYSTACK,
        email:
          prev.PAYSTACK.email ||
          String(contactInfo.email ?? profile?.email ?? ''),
        phone: prev.PAYSTACK.phone || paymentShippingAddress.phone,
      },
    }));
  }, [contactInfo.email, paymentShippingAddress.phone, profile?.email]);

  useEffect(() => {
    paymentInitIdempotencyKeyRef.current = null;
  }, [activePaymentData, orderId, paymentMethod, paymentShippingAddress]);

  const wrapMutation = async (
    work: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusy(true);
    try {
      await work();
      toast.success(successMessage);
      const refreshed = await customOrdersBuyerApi.getById(orderId);
      setOrder(refreshed);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update custom order');
    } finally {
      setBusy(false);
    }
  };

  const updateSelectedPaymentData = (
    updater: (current: PaystackPaymentData) => PaystackPaymentData,
  ) => {
    setPaymentState((prev) => ({
      ...prev,
      [paymentMethod]: updater(prev[paymentMethod]),
    }));
    setPaymentErrors({});
    setPaymentActionMessage(null);
  };

  const handlePayNow = async () => {
    // Guard against double-submit before setBusy(true) is reached.
    if (busy) return;
    if (!orderId) return;
    const validationErrors = validatePaymentData(
      paymentMethod,
      activePaymentData,
      paymentShippingAddress,
    );
    setPaymentErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setPaymentActionMessage('Resolve the highlighted payment details before continuing.');
      toast.error('Complete the payment details for the selected method');
      return;
    }

    const paymentSubmissionData = buildPaymentSubmissionData(
      activePaymentData,
      paymentShippingAddress,
    );
    let validationSessionId: string | undefined;
    const requiresCardValidation =
      paymentMethod === 'PAYSTACK' &&
      (paymentSubmissionData as PaystackPaymentData).channel === 'CARD' &&
      (
        (paymentSubmissionData as PaystackPaymentData).useSavedCard ||
        hasCollectedPaystackCardDraft(paymentSubmissionData as PaystackPaymentData)
      );
    if (requiresCardValidation) {
      setPaymentActionMessage('Validating card details before secure checkout...');
      const validated = await paymentApi.validateCard({
        paymentMethod: 'PAYSTACK',
        paymentData: paymentSubmissionData,
      });
      validationSessionId = validated.sessionId;
    }

    const paymentInitIdempotencyKey =
      paymentInitIdempotencyKeyRef.current ?? createIdempotencyKey();
    paymentInitIdempotencyKeyRef.current = paymentInitIdempotencyKey;
    setBusy(true);
    setPaymentActionMessage('Preparing your secure payment session...');
    try {
      const init = await customOrdersBuyerApi.initializePayment(orderId, {
        paymentMethod,
        email: paymentSubmissionData.email,
        callbackUrl: `${window.location.origin}/bag/payment-return`,
        paymentData: paymentSubmissionData as unknown as Record<string, unknown>,
        idempotencyKey: paymentInitIdempotencyKey,
        validationSessionId,
      });
      const resolvedGateway = resolvePaymentGateway(init);
      const session = resolveInAppPaymentSession(init);
      setPaymentGateway(resolvedGateway);
      setPaymentVerification(null);
      setPaymentActionMessage('Opening secure checkout inside Threadly...');
      const returnPath = `/bag/payment-return?reference=${encodeURIComponent(init.reference)}&gateway=${encodeURIComponent(resolvedGateway)}`;

      await openPaystackInline(session.accessCode, {
        onSuccess: () => {
          navigate(returnPath);
        },
        onCancel: () => {
          paymentInitIdempotencyKeyRef.current = null;
          setPaymentActionMessage('Secure checkout was cancelled. Review the details and try again.');
          toast.error('Payment was cancelled before the order could be placed.');
        },
        onError: (inlineError) => {
          paymentInitIdempotencyKeyRef.current = null;
          setPaymentActionMessage('Secure checkout could not be opened. Retry to continue.');
          toast.error(inlineError.message || 'Unable to open the payment window.');
        },
      });
      return;
    } catch (error: any) {
      paymentInitIdempotencyKeyRef.current = null;
      setPaymentActionMessage('Payment could not be initialized. Retry from inside Threadly.');
      toast.error(error?.response?.data?.message || error?.message || 'Unable to initialize payment');
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
      const verificationResult = await customOrdersBuyerApi.verifyPayment(
        orderId,
        {
          reference: order.paymentReference,
          gateway: paymentGateway || paymentMethod,
        },
      );
      setPaymentVerification(verificationResult);
      if (verificationResult.success) {
        toast.success('Payment verification completed.');
      } else if (verificationResult.awaitingProviderConfirmation) {
        toast.info(
          verificationResult.recoveryMessage ||
            'Payment is still awaiting provider confirmation.',
        );
      } else {
        toast.error(
          verificationResult.failureMessage ||
            'Payment is still pending or needs another attempt.',
        );
      }
      const refreshed = await customOrdersBuyerApi.getById(orderId);
      setOrder(refreshed);
      await refreshPaymentAttempts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to verify payment');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!canConfirmDelivery || !order) return;
    const approved = await confirm({
      title: 'Confirm delivery?',
      message:
        'Use this only after you have received the order and checked that it matches the agreed custom-order brief.',
      confirmText: 'Confirm delivery',
      cancelText: 'Keep reviewing',
    });
    if (!approved) return;
    await wrapMutation(
      () => customOrdersBuyerApi.confirmDelivery(order.id, deliveryNote.trim() || undefined),
      'Delivery confirmed',
    );
  };

  const handleReportIssue = async () => {
    if (!canReportIssue || issueDescription.trim().length < 10 || !order) return;
    const approved = await confirm({
      title: 'Report a delivery issue?',
      message: 'This opens a support and dispute review path for the order.',
      confirmText: 'Report issue',
      cancelText: 'Go back',
      isDestructive: true,
    });
    if (!approved) return;
    await wrapMutation(
      () =>
        customOrdersBuyerApi.reportIssue(order.id, {
          issueType,
          description: issueDescription.trim(),
        }),
      'Issue reported',
    );
  };

  const handleRespondToExtension = async () => {
    if (!latestOpenExtension || !order) return;
    const counterValue =
      extensionResponse === 'COUNTERED' ? Number(counterDays) : undefined;
    await wrapMutation(
      () =>
        customOrdersBuyerApi.respondToExtension(order.id, latestOpenExtension.id, {
          response: extensionResponse,
          counterDays: counterValue,
        }),
      'Extension response saved',
    );
  };

  const effectiveStage = getBuyerFacingProgressStage(
    order?.currentProgressStage ?? previewOrder?.currentProgressStage,
  );
  const timelineStageIndex = Math.max(
    BUYER_STAGE_FLOW.findIndex((step) => step.value === effectiveStage),
    0,
  );
  const timelineReceiptEntries = useMemo(() => {
    if (!order) return [];

    const progressRows = order.progressEvents.map((event) => ({
      id: `progress-${event.id}`,
      label: humanizeCustomOrderToken(event.stage),
      detail: event.note || 'Progress stage updated',
      occurredAt: event.changedAt,
      kind: 'PROGRESS' as const,
    }));

    const timelineRows = order.timelineEvents.slice(0, 10).map((event) => ({
      id: `timeline-${event.id}`,
      label: humanizeCustomOrderToken(event.eventType),
      detail: '',
      occurredAt: event.createdAt,
      kind: 'TIMELINE' as const,
    }));

    return [...progressRows, ...timelineRows].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }, [order]);
  const hasTimelineEntries = timelineReceiptEntries.length > 0;
  const mediaUrl = order?.source.primaryMediaUrl ?? previewOrder?.sourcePrimaryMediaUrl ?? null;
  const title = order?.source.title ?? previewOrder?.sourceTitle ?? 'Custom order';
  const brandName = order?.source.brandName ?? previewOrder?.brand?.name ?? 'Brand';
  const paymentStatusValue = order?.paymentStatus ?? previewOrder?.paymentStatus ?? null;
  const paymentPending = paymentStatusValue !== null && paymentStatusValue !== 'PAID';
  const grandTotal = order
    ? formatCurrency(
        order.buyerPriceSummary.grandTotal,
        order.buyerPriceSummary.currency ?? 'NGN',
      )
    : formatCurrency(
        previewOrder?.buyerPriceSummary.grandTotal ?? 0,
        previewOrder?.buyerPriceSummary.currency ?? 'NGN',
      );
  const paymentNeedsProviderConfirmation =
    paymentVerification?.awaitingProviderConfirmation === true;
  const paymentStatusLabel = paymentNeedsProviderConfirmation
    ? 'Payment awaiting confirmation'
    : paymentStatusValue === 'FAILED'
      ? 'Payment failed'
      : 'Awaiting payment';
  const headline = paymentPending ? paymentStatusLabel : getBuyerCustomHeadline(effectiveStage);
  const description = paymentPending
    ? paymentStatusValue === 'FAILED'
      ? 'Your payment did not complete. Please retry to place this custom order.'
      : 'Complete payment to place this custom order and notify the brand.'
    : getBuyerCustomDescription(effectiveStage);

  if (loading && previewOrder) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white"
          >
            Back to orders
          </button>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Custom order</div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04]">
          <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <CustomOrderMediaPreview
              src={previewOrder.sourcePrimaryMediaUrl}
              title={previewOrder.sourceTitle}
              className="min-h-[240px] lg:min-h-[320px]"
            />
            <div className="space-y-4">
              <BuyerCustomStageFiller
                stage={previewOrder.currentProgressStage}
                brandName={previewOrder.brand?.name}
                compact
                statusLabel={paymentPending ? paymentStatusLabel : null}
                progressIndex={paymentPending ? -1 : null}
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {formatCustomOrderCode(previewOrder.id)}
                </div>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {previewOrder.sourceTitle}
                </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {headline}. {description}
                  </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[104px] animate-pulse rounded-2xl border border-black/10 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.05]"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (loading && !previewOrder) {
    return <div className="rounded-3xl border border-gray-200/70 bg-white/70 p-8 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">Loading custom order...</div>;
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-300">
        Unable to load this custom order inside the profile workspace.
      </div>
    );
  }

  const measurementRows = Object.entries(order.measurementSnapshot ?? {}).map(([key, value]) => ({
    label: formatMeasurementLabel(key),
    value: formatMeasurementValue(value),
  }));

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white"
        >
          Back to orders
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/messages?customOrderId=${encodeURIComponent(order.id)}`)}
            className="rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white"
          >
            Open conversation
          </button>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Custom order</div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <CustomOrderMediaPreview
            src={mediaUrl}
            title={title}
            className="min-h-[240px] lg:min-h-[320px]"
          />
          <div>
            <BuyerCustomStageFiller
              stage={effectiveStage}
              brandName={brandName}
              statusLabel={paymentPending ? paymentStatusLabel : null}
              progressIndex={paymentPending ? -1 : null}
            />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {formatCustomOrderCode(order.id)}
                </div>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {title}
                </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {headline}. {description}
                  </p>
              </div>
              <div className="min-w-[180px] rounded-2xl border border-black/10 bg-white/80 p-4 text-right dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Locked total
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {grandTotal}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CustomOrderMetricCard
                label="Brand"
                value={textValue(brandName, 'Brand')}
                helper="Seller on this custom order"
              />
              <CustomOrderMetricCard
                label="Measurements"
                value={`${measurementRows.length}`}
                helper={formatDateTime(order.measurementConfirmedAt)}
              />
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
            </div>
          </div>
        </div>
      </section>

      {order.paymentStatus !== 'PAID' ? (
        <section className="rounded-[28px] border border-amber-200/80 bg-amber-50/80 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Payment must complete before production intake is locked
          </div>
          <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/90">
            {paymentNeedsProviderConfirmation
              ? paymentVerification?.recoveryMessage ||
                'Your payment attempt is waiting for provider confirmation.'
              : 'Choose the gateway and channel you want to use, then complete payment in the secure window.'}
          </p>
          {paymentVerification?.failureMessage && !paymentNeedsProviderConfirmation ? (
            <div className="mt-2 text-xs text-rose-700 dark:text-rose-200">
              {paymentVerification.failureMessage}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {CHECKOUT_PAYMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPaymentMethod(option.value);
                  setPaymentGateway(option.value);
                  setPaymentErrors({});
                  setPaymentActionMessage(null);
                }}
                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  paymentMethod === option.value
                    ? 'border-amber-500 bg-white/90 shadow-sm dark:bg-white/10'
                    : 'border-amber-200/80 bg-white/55 dark:border-amber-500/20 dark:bg-black/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{option.emoji}</span>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {option.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <PaymentDetailsSection
              paymentData={activePaymentData}
              shippingAddress={paymentShippingAddress}
              errors={paymentErrors}
              onChange={updateSelectedPaymentData}
              onStartNewCardCheckout={handlePayNow}
              startingNewCardCheckout={busy}
              compact
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {!isHostedNewCardSelection ? (
              <button
                type="button"
                onClick={handlePayNow}
                disabled={busy}
                className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy ? 'Opening payment...' : 'Pay now'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleVerifyPayment}
              disabled={busy || !order.paymentReference}
              className="rounded-full border border-amber-400/60 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60 dark:text-amber-100"
            >
              Verify payment
            </button>
          </div>
          {paymentActionMessage ? (
            <div className="mt-3 rounded-2xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              {paymentActionMessage}
            </div>
          ) : null}
          {order.paymentReference ? (
            <div className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/80">
              Reference: {order.paymentReference}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment attempts</h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {paymentAttemptsLoading ? 'Loading attempts...' : `${paymentAttempts.length} attempt(s)`}
          </div>
        </div>
        <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-gray-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]">
          {paymentAttemptsLoading ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading payment attempts...</div>
          ) : paymentAttempts.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No payment attempts yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/90 text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:bg-slate-900/90 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Reference</th>
                  <th className="px-3 py-2 text-left font-semibold">Gateway</th>
                  <th className="px-3 py-2 text-left font-semibold">Created</th>
                  <th className="px-3 py-2 text-left font-semibold">Confirmed</th>
                  <th className="px-3 py-2 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {paymentAttempts.map((attempt) => (
                  <tr key={attempt.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-3 py-2">
                      <span className="mr-1">{paymentAttemptEmoji(attempt.status)}</span>
                      {attempt.status}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <span className="block max-w-[140px] truncate" title={attempt.reference}>
                        {attempt.reference}
                      </span>
                    </td>
                    <td className="px-3 py-2">{attempt.provider}</td>
                    <td className="px-3 py-2">{formatDateTime(attempt.createdAt)}</td>
                    <td className="px-3 py-2">
                      {attempt.confirmedAt ? formatDateTime(attempt.confirmedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 text-rose-600 dark:text-rose-300">
                      {attempt.failureMessage || attempt.failureCode || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer and delivery details</h3>
          <div className="mt-4 space-y-4">
            <CustomOrderDataTable
              rows={[
                { label: 'Customer', value: textValue(contactInfo.customerName) },
                { label: 'Email', value: textValue(contactInfo.email) },
                { label: 'Phone', value: textValue(contactInfo.phone) },
              ]}
            />
            <CustomOrderDataTable
              rows={[
                { label: 'Street', value: textValue(shippingAddress.street) },
                { label: 'City', value: textValue(shippingAddress.city) },
                { label: 'State', value: textValue(shippingAddress.state) },
                { label: 'Country', value: textValue(shippingAddress.country) },
              ]}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Measurements</h3>
          <div className="mt-4">
            <CustomOrderDataTable rows={measurementRows} />
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Timeline</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Filled tabs show completed work, while the highlighted tab is the current phase.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {BUYER_STAGE_FLOW.map((step, index) => {
            const tone = BUYER_TIMELINE_TAB_TONES[index % BUYER_TIMELINE_TAB_TONES.length];
            const isComplete = index < timelineStageIndex;
            const isCurrent = index === timelineStageIndex;
            const stateLabel = isCurrent ? 'Current' : isComplete ? 'Completed' : 'Upcoming';
            const badgeEmoji = isCurrent ? '🟡' : isComplete ? '✅' : '⚪';

            return (
              <div
                key={step.value}
                className={`rounded-2xl border px-3 py-3 transition ${
                  isCurrent
                    ? tone.current
                    : isComplete
                      ? tone.completed
                      : 'border-gray-200/80 bg-white/80 text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em]">{stateLabel}</div>
                  <span className="text-sm" aria-hidden="true">{badgeEmoji}</span>
                </div>
                <div className="mt-2 text-sm font-semibold leading-5">{step.label}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-violet-500 transition-all duration-500"
            style={{ width: `${((timelineStageIndex + 1) / BUYER_STAGE_FLOW.length) * 100}%` }}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 text-gray-900 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
          <div className="flex items-center justify-between border-b border-gray-200/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600 dark:border-white/10 dark:text-gray-300">
            <span>Activity receipt</span>
            <span>{formatCustomOrderCode(order.id)}</span>
          </div>

          {!hasTimelineEntries ? (
            <div className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">No custom-order activity has been recorded yet.</div>
          ) : (
            <div className="divide-y divide-gray-200/80 dark:divide-white/10">
              {timelineReceiptEntries.map((entry, index) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{entry.label}</span>
                      </div>
                      {entry.detail ? (
                        <div className="mt-1 pl-8 text-xs leading-5 text-gray-600 dark:text-gray-300">{entry.detail}</div>
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{formatDateTime(entry.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Support and actions</h3>
        <div className="mt-4 grid gap-6 xl:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Conversation and extension</div>
              <button
                type="button"
                onClick={() => navigate(`/messages?customOrderId=${encodeURIComponent(order.id)}`)}
                className="rounded-full border border-gray-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white"
              >
                Open conversation
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {order.extensionRequests.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No extension requests have been raised on this order.
                </div>
              ) : (
                order.extensionRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {humanizeCustomOrderToken(request.targetType)} +{request.requestedExtraDays} day(s)
                      </div>
                      <CustomOrderBadge value={request.buyerResponseStatus} type="payment" />
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{request.reason}</div>
                  </div>
                ))
              )}
            </div>
            {latestOpenExtension ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <UniversalSelect
                  value={extensionResponse}
                  onChange={(value) =>
                    setExtensionResponse(value as CustomOrderExtensionResponseStatus)
                  }
                  options={[
                    { value: 'ACCEPTED', label: 'Accept' },
                    { value: 'COUNTERED', label: 'Counter' },
                    { value: 'REJECTED', label: 'Reject' },
                  ]}
                />
                {extensionResponse === 'COUNTERED' ? (
                  <input
                    value={counterDays}
                    onChange={(event) => setCounterDays(event.target.value)}
                    placeholder="Counter days"
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRespondToExtension}
                  className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                >
                  Send response
                </button>
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Issues and buyer actions</div>
            {activeDispute ? (
              <div className="mt-4 rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-500/10 dark:text-rose-100">
                <div className="font-semibold">Active dispute</div>
                <div className="mt-1">Status: {humanizeCustomOrderToken(activeDispute.status)}</div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">No active dispute on this order.</div>
            )}
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Confirm delivery</div>
                <textarea
                  value={deliveryNote}
                  onChange={(event) => setDeliveryNote(event.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="Optional confirmation note"
                />
                <button
                  type="button"
                  disabled={busy || !canConfirmDelivery}
                  onClick={handleConfirmDelivery}
                  className="mt-3 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Confirm delivery
                </button>
              </div>
              <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Report issue</div>
                <div className="mt-3">
                  <UniversalSelect
                    value={issueType}
                    onChange={(value) => setIssueType(value as CustomOrderIssueType)}
                    options={[
                      { value: 'MEASUREMENT_NON_COMPLIANCE', label: 'Measurement non-compliance' },
                      { value: 'MATERIAL_DEFECT', label: 'Material defect' },
                      { value: 'UNFINISHED_WORK', label: 'Unfinished work' },
                      { value: 'NON_DELIVERY', label: 'Non-delivery' },
                      { value: 'UNREASONABLE_DELAY', label: 'Unreasonable delay' },
                      { value: 'WRONG_ITEM', label: 'Wrong item' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                </div>
                <textarea
                  value={issueDescription}
                  onChange={(event) => setIssueDescription(event.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="Describe the issue"
                />
                <button
                  type="button"
                  disabled={busy || !canReportIssue || issueDescription.trim().length < 10}
                  onClick={handleReportIssue}
                  className="mt-3 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Report issue
                </button>
                {!acceptanceWindowOpen && order.status === 'DELIVERED_PENDING_BUYER_CONFIRMATION' ? (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Delivery issues can only be reported while the buyer acceptance window is still open.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const OrdersPanel: React.FC<OrdersPanelProps> = ({
  mode = 'summary',
  onViewAll,
  initialSelection,
  onSelectionHandled,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [standardOrders, setStandardOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [standardStatus, setStandardStatus] = useState<StandardStatusFilter>('ALL');
  const [customStatus, setCustomStatus] = useState<CustomStatusFilter>('ALL');
  const [activeView, setActiveView] = useState<OrdersView>('standard');
  const [selectedCustomPreview, setSelectedCustomPreview] = useState<CustomOrderListItem | null>(null);

  // In full mode, selection is URL-driven so browser back/forward works correctly
  const urlOrderId = mode === 'full' ? searchParams.get('orderId') : null;
  const rawUrlKind = mode === 'full' ? searchParams.get('kind') : null;
  const urlKind: OrdersView | null =
    rawUrlKind === 'standard' || rawUrlKind === 'custom' ? rawUrlKind : null;
  const urlSelection: OrdersPanelSelection | null =
    urlOrderId && urlKind ? { kind: urlKind, id: urlOrderId } : null;
  const [localSelection, setLocalSelection] = useState<OrdersPanelSelection | null>(null);
  const selection = mode === 'full' ? urlSelection : localSelection;
  const [standardSummaryByOrderId, setStandardSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});
  const [customSummaryByOrderId, setCustomSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [standardResponse, customResponse] = await Promise.all([
          getMyOrders(1, 50),
          customOrdersBuyerApi.list({ page: 1, limit: 50 }),
        ]);

        if (!mounted) return;

        const nextStandardOrders = Array.isArray(standardResponse?.items) ? standardResponse.items : [];
        const nextCustomOrders = Array.isArray(customResponse?.items) ? customResponse.items : [];

        setStandardOrders(nextStandardOrders);
        setCustomOrders(nextCustomOrders);

        const standardIds = nextStandardOrders.map((item) => item.id).filter(Boolean);
        const customIds = nextCustomOrders.map((item) => item.id).filter(Boolean);

        const [standardSummaries, customSummaries] = await Promise.all([
          standardIds.length > 0
            ? messagingApi.getBulkOrderSummaries(standardIds, true)
            : Promise.resolve({ items: [] }),
          customIds.length > 0
            ? messagingApi.getBulkCustomOrderSummaries(customIds, true)
            : Promise.resolve({ items: [] }),
        ]);

        if (!mounted) return;

        setStandardSummaryByOrderId(
          standardSummaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
        setCustomSummaryByOrderId(
          customSummaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
      } catch (err) {
        if (!mounted) return;
        setStandardOrders([]);
        setCustomOrders([]);
        setError('Unable to load your orders right now.');
        console.error('Orders panel failed to fetch orders:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialSelection || mode !== 'full') return;
    setActiveView(initialSelection.kind);
    // Update URL so browser back works
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('kind', initialSelection.kind);
      next.set('orderId', initialSelection.id);
      return next;
    });
    setSelectedCustomPreview(
      initialSelection.kind === 'custom'
        ? customOrders.find((item) => item.id === initialSelection.id) ?? null
        : null,
    );
    onSelectionHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelection, mode, onSelectionHandled]);

  useEffect(() => {
    if (mode !== 'full' || !urlKind) return;
    setActiveView(urlKind);
  }, [mode, urlKind]);

  const standardFilteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return standardOrders.filter((order) => {
      const normalized = normalizeStatus(order.status);
      const statusMatch = standardStatus === 'ALL' || normalized === standardStatus;
      if (!statusMatch) return false;
      if (!needle) return true;
      return standardOrderSummarySearchText(order).includes(needle);
    });
  }, [query, standardOrders, standardStatus]);

  const customFilteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customOrders.filter((order) => {
      const bucket = customStatusBucket(order.status);
      const statusMatch = customStatus === 'ALL' || bucket === customStatus;
      if (!statusMatch) return false;
      if (!needle) return true;
      return customOrderSummarySearchText(order).includes(needle);
    });
  }, [customOrders, customStatus, query]);

  const visibleStandardOrders = mode === 'full' ? standardFilteredOrders : standardFilteredOrders.slice(0, 6);
  const visibleCustomOrders = mode === 'full' ? customFilteredOrders : customFilteredOrders.slice(0, 6);
  const activeCount = activeView === 'standard' ? standardFilteredOrders.length : customFilteredOrders.length;

  const handleSelect = (nextSelection: OrdersPanelSelection) => {
    if (mode === 'summary') {
      if (onViewAll) {
        onViewAll(nextSelection);
        return;
      }
      // Summary mode without parent handler: navigate to profile orders tab with selection
      navigate(`/profile?tab=orders&kind=${nextSelection.kind}&orderId=${nextSelection.id}`);
      return;
    }

    // Full mode: push URL so browser back returns to the orders list
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('kind', nextSelection.kind);
      next.set('orderId', nextSelection.id);
      return next;
    });
    setActiveView(nextSelection.kind);
    if (nextSelection.kind === 'custom') {
      setSelectedCustomPreview(
        customOrders.find((item) => item.id === nextSelection.id) ?? null,
      );
    } else {
      setSelectedCustomPreview(null);
    }
    setLocalSelection(nextSelection);
  };

  const clearDetailSelection = useCallback(() => {
    setLocalSelection(null);
    setSelectedCustomPreview(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('orderId');
      next.delete('kind');
      return next;
    });
  }, [setSearchParams]);

  const handleViewChange = useCallback(
    (view: OrdersView) => {
      setActiveView(view);
      if (mode !== 'full') return;

      setLocalSelection(null);
      setSelectedCustomPreview(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('kind', view);
        next.delete('orderId');
        return next;
      });
    },
    [mode, setSearchParams],
  );

  if (mode === 'full' && selection) {
    return selection.kind === 'standard' ? (
      <StandardOrderDetailView orderId={selection.id} onBack={clearDetailSelection} />
    ) : (
      <BuyerCustomOrderDetailView
        orderId={selection.id}
        previewOrder={selectedCustomPreview}
        onBack={clearDetailSelection}
      />
    );
  }

  return (
    <div className={mode === 'full' ? '' : 'space-y-4 lg:sticky lg:top-24 lg:self-start'}>
      <section className={mode === 'full' ? '' : 'glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-5'}>
        <div className="mb-2 flex items-center justify-between gap-3">
          {mode === 'full' ? (
            <span className="text-xs font-bold uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-400">
              {activeCount} item{activeCount === 1 ? '' : 's'}
            </span>
          ) : (
            <>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Orders</h3>
              <button
                type="button"
                onClick={() => {
                  if (onViewAll) {
                    onViewAll();
                    return;
                  }
                  navigate('/profile?tab=orders');
                }}
                className="text-xs font-bold uppercase tracking-wide text-fuchsia-600 transition hover:text-gray-900 dark:text-fuchsia-300 dark:hover:text-white"
              >
                View All
              </button>
            </>
          )}
        </div>

        <div className="mb-4 inline-flex rounded-2xl border border-gray-200/80 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
          {(['standard', 'custom'] as const).map((view) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => handleViewChange(view)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {view === 'standard' ? 'Standard Orders' : 'Custom Orders'}
              </button>
            );
          })}
        </div>

        <div className="relative mb-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeView === 'standard'
                ? 'Search standard orders...'
                : 'Search custom orders...'
            }
            className="w-full rounded-2xl border border-gray-200/80 bg-white/70 py-2.5 pl-4 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {(activeView === 'standard' ? STANDARD_STATUS_OPTIONS : CUSTOM_STATUS_OPTIONS).map((opt) => {
            const active = activeView === 'standard' ? standardStatus === opt : customStatus === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (activeView === 'standard') {
                    setStandardStatus(opt as StandardStatusFilter);
                    return;
                  }
                  setCustomStatus(opt as CustomStatusFilter);
                }}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-fuchsia-500 text-white'
                    : 'border border-gray-200/80 bg-white/60 text-gray-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                }`}
              >
                {opt === 'ALL'
                  ? 'All'
                  : opt === 'PROCESSING'
                    ? 'Proc.'
                    : opt.charAt(0) + opt.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
            ))
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              {error}
            </div>
          ) : activeView === 'standard' ? (
            visibleStandardOrders.length === 0 ? (
              <EmptyOrdersState
                query={query}
                filtered={standardStatus !== 'ALL'}
                onBrowse={() => navigate('/market')}
                label="standard"
              />
            ) : (
              visibleStandardOrders.map((order) => {
                const normalizedStatus = normalizeStatus(order.status);
                const completedSegments = progressSegments(normalizedStatus);
                const firstItem = order.items?.[0];
                const summary = standardSummaryByOrderId[order.id];
                const unreadCount = Number(summary?.unreadCount ?? 0);

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleSelect({ kind: 'standard', id: order.id })}
                    className="w-full rounded-2xl bg-white/65 p-3 text-left shadow-[0_14px_40px_rgba(15,23,42,0.05)] transition hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/10"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                        #ORD-{order.id.slice(0, 4).toUpperCase()}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(normalizedStatus)}`}>
                        {normalizedStatus}
                      </span>
                    </div>

                    <div className="mb-3 flex items-start gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
                        {firstItem?.thumbnail ? (
                          <ImageWithFallback
                            src={firstItem.thumbnail}
                            alt={firstItem.name || 'Order item'}
                            className="h-full w-full"
                            containerClassName="h-full w-full"
                            fit="contain"
                            rounded="none"
                            maxHeightClassName="max-h-[85vh]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                          {firstItem?.name || 'Order'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</p>
                        {summary?.hasUnread ? (
                          <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {unreadCount > 0 ? `${unreadCount} unread messages` : 'New messages'}
                          </p>
                        ) : null}
                      </div>

                      <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-1.5 w-full rounded-full ${
                            idx < completedSegments
                              ? 'bg-fuchsia-500 dark:bg-fuchsia-400'
                              : 'bg-gray-200 dark:bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })
            )
          ) : visibleCustomOrders.length === 0 ? (
            <EmptyOrdersState
              query={query}
              filtered={customStatus !== 'ALL'}
              onBrowse={() => navigate('/market')}
              label="custom"
            />
          ) : (
            visibleCustomOrders.map((order) => {
              const summary = customSummaryByOrderId[order.id];
              const unreadCount = Number(summary?.unreadCount ?? 0);

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => handleSelect({ kind: 'custom', id: order.id })}
                    className="w-full rounded-[1.7rem] bg-white/65 p-3.5 text-left shadow-[0_14px_40px_rgba(15,23,42,0.05)] transition hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/10"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                      {formatCustomOrderCode(order.id)}
                    </span>
                    {shouldShowBuyerStatusBadge(order.status) ? <CustomOrderBadge value={order.status} /> : null}
                    <CustomOrderBadge
                      value={getBuyerFacingProgressStage(order.currentProgressStage)}
                      type="stage"
                    />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[92px_minmax(0,1fr)_auto] lg:items-start">
                    <div className="h-[92px] overflow-hidden rounded-[1.25rem] bg-gray-100 dark:bg-white/10">
                      {order.sourcePrimaryMediaUrl ? (
                        <ImageWithFallback
                          src={order.sourcePrimaryMediaUrl}
                          alt={order.sourceTitle}
                          className="h-full w-full"
                          containerClassName="h-full w-full"
                          fit="contain"
                          rounded="none"
                          maxHeightClassName="max-h-[85vh]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl opacity-30">
                          🧵
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="line-clamp-1 text-lg font-bold text-gray-900 dark:text-white">
                        {order.sourceTitle}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {order.brand?.name || 'Brand'} · {formatDate(order.createdAt)}
                      </div>
                      {summary?.hasUnread ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'New messages'}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-3 grid gap-1 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                        <span>Delivery: {order.delivery?.city || order.delivery?.state || 'Not scheduled'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold text-gray-900 dark:text-white">
                        {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {order.measurementCount ?? 0} measurements
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {mode === 'summary' && activeView === 'standard' && standardOrders.length > 0 ? (
        <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-5 text-center backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <h4 className="text-base font-bold text-gray-900 dark:text-white">Threadly Pro</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Unlock exclusive drops and lower fees.</p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Upgrade Now
          </button>
        </section>
      ) : mode === 'summary' ? (
        <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-5 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <h4 className="text-base font-bold text-gray-900 dark:text-white">Buyer Protection</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Every purchase on Threadly is covered by our authenticity and fulfillment protections.
          </p>
        </section>
      ) : null}
    </div>
  );
};

const EmptyOrdersState: React.FC<{
  query: string;
  filtered: boolean;
  onBrowse: () => void;
  label: 'standard' | 'custom';
}> = ({ query, filtered, onBrowse, label }) => (
  <div className="rounded-3xl border border-gray-200/70 bg-white/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
      {label === 'standard' ? 'No standard orders yet' : 'No custom orders yet'}
    </h4>
    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
      {query || filtered
        ? 'No orders match your current filters.'
        : label === 'standard'
          ? 'Your standard orders will appear here once you start shopping.'
          : 'Your made-to-measure custom orders will appear here once you place one.'}
    </p>
    <button
      type="button"
      onClick={onBrowse}
      className="mt-4 text-sm font-bold text-fuchsia-600 transition hover:text-gray-900 dark:text-fuchsia-300 dark:hover:text-white"
    >
      Start Browsing
    </button>
  </div>
);

const InfoPill: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
      {label}
    </p>
    <p className={`mt-1 text-sm font-semibold text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>
      {value}
    </p>
  </div>
);

const ReceiptRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong = false,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-dashed border-gray-200/80 pb-2 last:border-b-0 last:pb-0 dark:border-white/10">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className={`text-right ${strong ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
      {value}
    </span>
  </div>
);
