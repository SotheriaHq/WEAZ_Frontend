import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  confirmMyOrderDelivery,
  getMyOrder,
  getMyOrders,
  type Order,
} from '@/api/StoreApi';
import {
  customOrdersBuyerApi,
  type CustomOrderDetail,
  type CustomOrderListItem,
  type CustomOrderProgressStage,
} from '@/api/CustomOrderApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import {
  CustomOrderBadge,
  CustomOrderDataTable,
  CustomOrderMediaPreview,
  CustomOrderMetricCard,
  CustomOrderStageProgress,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import {
  formatCustomOrderCode,
  formatMeasurementLabel,
  formatMeasurementValue,
  humanizeCustomOrderToken,
} from '@/components/custom-orders/customOrderFormatting';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';

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

const CUSTOM_STAGE_FLOW: Array<{ value: CustomOrderProgressStage; label: string }> = [
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_RECEIVED', label: 'Order received' },
  { value: 'FABRIC_AND_PIECE_PURCHASE_GATHERING', label: 'Fabric and piece gathering' },
  { value: 'DESIGN_MODE', label: 'Design mode' },
  { value: 'FINAL_TOUCHES_AND_PACKAGING', label: 'Final touches and packaging' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for delivery' },
];

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
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]">
            {firstItem?.thumbnail ? (
              <ImageWithFallback
                src={firstItem.thumbnail}
                alt={firstItem.name}
                fit="cover"
                rounded="none"
                className="h-full w-full object-cover"
                containerClassName="h-full min-h-[180px] w-full"
              />
            ) : (
              <div className="flex min-h-[180px] w-full items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500">
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

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
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
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/10">
                  {item.thumbnail ? (
                    <ImageWithFallback
                      src={item.thumbnail}
                      alt={item.name}
                      className="h-full w-full"
                      containerClassName="h-full w-full"
                      fit="cover"
                      rounded="none"
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

const BuyerCustomOrderDetailView: React.FC<{ orderId: string; onBack: () => void }> = ({
  orderId,
  onBack,
}) => {
  const navigate = useNavigate();
  const [order, setOrder] = useState<CustomOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const data = await customOrdersBuyerApi.getById(orderId);
        if (!mounted) return;
        setOrder(data);
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

  if (loading) {
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
  const shippingAddress = ((order.shippingAddress ?? null) as Record<string, unknown> | null) ?? {};
  const contactInfo = ((order.contactInfo ?? null) as Record<string, unknown> | null) ?? {};

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
          <CustomOrderMediaPreview src={order.source.primaryMediaUrl} title={order.source.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CustomOrderBadge value={order.status} />
              <CustomOrderBadge value={order.paymentStatus} type="payment" />
              <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {formatCustomOrderCode(order.id)}
                </div>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {order.source.title}
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Review your custom-order status, delivery commitments, measurements, and support details without leaving the profile workspace.
                </p>
              </div>
              <div className="min-w-[180px] rounded-2xl border border-black/10 bg-white/80 p-4 text-right dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Locked total
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(
                    order.buyerPriceSummary.grandTotal,
                    order.buyerPriceSummary.currency ?? 'NGN',
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CustomOrderMetricCard
                label="Brand"
                value={textValue(order.source.brandName, 'Brand')}
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

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom order progress</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The brand progress flow stays visible here from order placement through delivery readiness.
        </p>
        <div className="mt-4">
          <CustomOrderStageProgress
            stages={CUSTOM_STAGE_FLOW}
            currentStage={order.currentProgressStage ?? 'ORDER_PLACED'}
          />
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
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {order.progressEvents.length === 0 && order.timelineEvents.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No custom-order activity has been recorded yet.</div>
          ) : (
            <>
              {order.progressEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CustomOrderBadge value={event.stage} type="stage" />
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(event.changedAt)}</div>
                  </div>
                  {event.note ? (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">{event.note}</div>
                  ) : null}
                </div>
              ))}
              {order.timelineEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {humanizeCustomOrderToken(event.eventType)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
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
  const [standardOrders, setStandardOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [standardStatus, setStandardStatus] = useState<StandardStatusFilter>('ALL');
  const [customStatus, setCustomStatus] = useState<CustomStatusFilter>('ALL');
  const [activeView, setActiveView] = useState<OrdersView>('standard');
  const [selection, setSelection] = useState<OrdersPanelSelection | null>(null);
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
    setSelection(initialSelection);
    onSelectionHandled?.();
  }, [initialSelection, mode, onSelectionHandled]);

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

      if (nextSelection.kind === 'standard') {
        navigate(`/orders/${nextSelection.id}`);
      } else {
        navigate(`/custom-orders/${nextSelection.id}`);
      }
      return;
    }

    setSelection(nextSelection);
  };

  if (mode === 'full' && selection) {
    return selection.kind === 'standard' ? (
      <StandardOrderDetailView orderId={selection.id} onBack={() => setSelection(null)} />
    ) : (
      <BuyerCustomOrderDetailView orderId={selection.id} onBack={() => setSelection(null)} />
    );
  }

  return (
    <div className={mode === 'full' ? 'space-y-4' : 'space-y-4 lg:sticky lg:top-24 lg:self-start'}>
      <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {mode === 'full' ? 'All Orders' : 'Recent Orders'}
          </h3>
          <button
            type="button"
            onClick={() => {
              if (mode === 'full') return;
              if (onViewAll) {
                onViewAll();
                return;
              }
              navigate('/orders');
            }}
            className="text-xs font-bold uppercase tracking-wide text-fuchsia-600 transition hover:text-gray-900 dark:text-fuchsia-300 dark:hover:text-white"
          >
            {mode === 'full' ? `${activeCount} item${activeCount === 1 ? '' : 's'}` : 'View All'}
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-2xl border border-gray-200/80 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
          {(['standard', 'custom'] as const).map((view) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
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
                            fit="cover"
                            rounded="none"
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
                    <CustomOrderBadge value={order.status} />
                    <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[92px_minmax(0,1fr)_auto] lg:items-start">
                    <div className="h-[92px] overflow-hidden rounded-[1.25rem] bg-gray-100 dark:bg-white/10">
                      {order.sourcePrimaryMediaUrl ? (
                        <ImageWithFallback
                          src={order.sourcePrimaryMediaUrl}
                          alt={order.sourceTitle}
                          className="h-full w-full"
                          containerClassName="h-full w-full"
                          fit="cover"
                          rounded="none"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          No image
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CustomOrderBadge value={order.paymentStatus} type="payment" />
                        {summary?.hasUnread ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'New messages'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                        <span>Stage: {humanizeCustomOrderToken(order.currentProgressStage ?? 'ORDER_PLACED')}</span>
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
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
