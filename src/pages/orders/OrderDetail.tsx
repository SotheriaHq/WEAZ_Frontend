import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { confirmMyOrderDelivery, getMyOrder, resolveOrderAccess, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import LazyOrderQrCard from '@/components/qr/LazyOrderQrCard';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import ImageWithFallback from '@/components/ImageWithFallback';
import VLoader from '@/components/loaders/VLoader';

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
};

const getStatusBadgeClasses = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    case 'RETURNED':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300';
  }
};

const getStatusMarker = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return '✅';
    case 'SHIPPED':
      return '🚚';
    case 'PROCESSING':
      return '🧵';
    case 'CANCELLED':
      return '⛔';
    case 'RETURNED':
      return '↩️';
    default:
      return '📦';
  }
};

const getStatusHeadline = (order: Order) => {
  if (order.buyerConfirmedDeliveryAt) {
    return 'You have confirmed receipt of this order';
  }

  switch (order.status) {
    case 'SHIPPED':
      return 'Your order is on the way';
    case 'DELIVERED':
      return 'Your order has been delivered';
    case 'PROCESSING':
      return 'The brand is preparing your order';
    case 'CANCELLED':
      return 'This order was cancelled';
    case 'RETURNED':
      return 'This order has been returned';
    default:
      return 'Your order has been placed';
  }
};

const getStatusDescription = (order: Order) => {
  if (order.buyerConfirmedDeliveryAt) {
    return `Receipt confirmed on ${formatDateTime(order.buyerConfirmedDeliveryAt)}.`;
  }

  switch (order.status) {
    case 'SHIPPED':
      return 'The brand has shipped this order. Once it is marked delivered, the receipt confirmation button will appear here.';
    case 'DELIVERED':
      return 'The brand marked this order delivered. If the package has reached you, confirm receipt below.';
    case 'PROCESSING':
      return 'Payment is in and the brand is working on your order before dispatch.';
    case 'CANCELLED':
      return 'This order is no longer active.';
    case 'RETURNED':
      return 'This order moved into a returned state.';
    default:
      return 'You can track each fulfillment step here without leaving this page.';
  }
};

type TimelineStep = {
  key: string;
  label: string;
  detail: string;
  complete: boolean;
  current?: boolean;
  time?: string | null;
};

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { flags, isLoading: reviewFlagsLoading } = useReviewRuntimeFlags();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchOrder = async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const access = await resolveOrderAccess(orderId);
        if (!active) return;
        if (access.destination !== `/orders/${orderId}`) {
          navigate(access.destination, { replace: true });
          return;
        }

        const data = await getMyOrder(orderId);
        if (!active) return;
        setOrder(data as any);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Order not found');
        navigate('/orders');
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchOrder();

    return () => {
      active = false;
    };
  }, [navigate, orderId]);

  const canConfirmDelivery =
    order?.status === 'DELIVERED' &&
    order.paymentStatus === 'PAID' &&
    !order.buyerConfirmedDeliveryAt;

  const firstItem = order?.items?.[0] ?? null;

  const timelineSteps = useMemo<TimelineStep[]>(() => {
    if (!order) return [];

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
        detail: 'Your package is in transit to you.',
        complete: isShippedOrLater,
        current: order.status === 'SHIPPED',
        time: order.status === 'SHIPPED' ? order.updatedAt : null,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        detail: 'The brand marked the order as delivered.',
        complete: isDeliveredOrLater,
        current: order.status === 'DELIVERED' && !order.buyerConfirmedDeliveryAt,
        time: order.deliveredAt,
      },
      {
        key: 'confirmed',
        label: 'Receipt confirmed by you',
        detail: 'This is completed when you confirm that the package reached you.',
        complete: Boolean(order.buyerConfirmedDeliveryAt),
        current: false,
        time: order.buyerConfirmedDeliveryAt,
      },
    ];
  }, [order]);

  const handleConfirmDelivery = async () => {
    if (!orderId || !canConfirmDelivery) return;
    setConfirmingDelivery(true);
    try {
      const updated = await confirmMyOrderDelivery(orderId);
      setOrder(updated as any);
      toast.success('Delivery confirmed');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to confirm delivery');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl justify-center px-4 py-10">
        <VLoader size={56} phase="loading" />
      </div>
    );
  }

  if (!order) {
    return <div className="mx-auto max-w-4xl px-4 py-10">Order not found.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="font-semibold transition-colors hover:text-black dark:hover:text-white"
        >
          Back
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="transition-colors hover:text-black dark:hover:text-white"
        >
          Orders
        </button>
        <span>/</span>
        <span className="font-medium text-gray-900 dark:text-white">#{order.id.slice(0, 8)}</span>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-gray-200/80 bg-white/70 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <div className="grid gap-6 p-6 md:grid-cols-[180px_minmax(0,1fr)]">
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
              <div className="flex min-h-[180px] w-full items-center justify-center text-5xl text-gray-300 dark:text-gray-600">
                <span aria-hidden="true">📦</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(order.status)}`}
                >
                  <span aria-hidden="true">{getStatusMarker(order.status)}</span>
                  {order.status}
                </div>
                <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  {getStatusHeadline(order)}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {getStatusDescription(order)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(Number(order.totalAmount), order.currency || 'NGN')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoPill label="Brand" value={order.brand?.name || 'Brand'} />
              <InfoPill label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} mono />
              <InfoPill label="Placed" value={formatDateTime(order.createdAt) || 'Recorded'} />
              <InfoPill label="Latest update" value={formatDateTime(order.updatedAt) || 'Recent'} />
            </div>

            {order.status === 'SHIPPED' ? (
              <div className="rounded-2xl border border-blue-300/70 bg-blue-50/80 px-4 py-4 text-sm text-blue-900 dark:border-blue-800/40 dark:bg-blue-500/10 dark:text-blue-100">
                <p className="font-semibold">In transit</p>
                <p className="mt-1">
                  This order has been shipped. When the brand marks it delivered, the receipt confirmation button will appear on this page automatically.
                </p>
              </div>
            ) : null}

            {canConfirmDelivery ? (
              <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                <p className="font-semibold">Your package has arrived?</p>
                <p className="mt-1">
                  Confirming receipt tells the system you got the order successfully.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleConfirmDelivery()}
                    disabled={confirmingDelivery}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmingDelivery ? 'Confirming...' : 'I have received this order'}
                  </button>
                </div>
              </div>
            ) : null}

            {order.buyerConfirmedDeliveryAt ? (
              <div className="rounded-2xl border border-sky-300/70 bg-sky-50/80 px-4 py-4 text-sm text-sky-900 dark:border-sky-800/40 dark:bg-sky-500/10 dark:text-sky-100">
                <p className="font-semibold">Receipt confirmed</p>
                <p className="mt-1">
                  You confirmed this order on {formatDateTime(order.buyerConfirmedDeliveryAt)}.
                </p>
              </div>
            ) : null}

            {order.paymentStatus !== 'PAID' && order.paymentReference ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-4 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">Payment still pending</p>
                <p className="mt-1">
                  This order has a pending payment reference. You can reopen the payment flow and continue from where you stopped.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/checkout/confirmation?reference=${encodeURIComponent(
                          order.paymentReference!,
                        )}`,
                      )
                    }
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
                  >
                    Resume payment
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order progress</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Every fulfillment stage appears here so you know exactly what is happening.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {timelineSteps.map((step) => {
            const stateTone = step.complete
              ? 'border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
              : step.current
                ? 'border-blue-300/70 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10'
                : 'border-gray-200 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.03]';

            const marker = step.complete ? '✅' : step.current ? '🟣' : '⚪';

            return (
              <div key={step.key} className={`rounded-2xl border p-4 ${stateTone}`}>
                <div className="flex items-start gap-3">
                  <div className="text-lg" aria-hidden="true">{marker}</div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.label}</p>
                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{step.detail}</p>
                    {step.time ? (
                      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        {formatDateTime(step.time)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order items</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Product preview, quantity, and amount for each item in this order.
            </p>
          </div>
        </div>

        <div className="space-y-3">
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
                    <div className="flex h-full w-full items-center justify-center text-xl">
                      <span aria-hidden="true">📦</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                  <div className="flex flex-wrap gap-2 text-gray-500">
                    {item.selectedSize ? <span>Size: {item.selectedSize}</span> : null}
                    {item.selectedColor ? <span>Color: {item.selectedColor}</span> : null}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Qty {item.quantity}</p>
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

        <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 text-sm dark:border-gray-800 sm:grid-cols-2 xl:grid-cols-4">
          <InfoPill
            label="Subtotal"
            value={formatCurrency(Number(order.totalAmount), order.currency || 'NGN')}
          />
          <InfoPill
            label="Shipping"
            value={formatCurrency(Number(order.shippingCost || 0), order.currency || 'NGN')}
          />
          <InfoPill
            label="Discount"
            value={formatCurrency(Number(order.discountAmount || 0), order.currency || 'NGN')}
          />
          <InfoPill label="Payment status" value={order.paymentStatus} />
        </div>

        {order.orderItems?.length ? (
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review status</div>
            {!reviewFlagsLoading && !flags.writeEnabled ? (
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Reviews are temporarily unavailable.
              </div>
            ) : null}
            {order.orderItems.map((item) => (
              <div
                key={item.orderItemId || item.id || item.productId}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {item.productName || item.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {[
                      item.selectedSize ? `Size ${item.selectedSize}` : null,
                      item.selectedColor ? `Color ${item.selectedColor}` : null,
                    ]
                      .filter(Boolean)
                      .join(' / ') || 'Review status attached to this order item.'}
                  </div>
                </div>

                {flags.writeEnabled && item.reviewState === 'CAN_CREATE' ? (
                  <button
                    type="button"
                    onClick={() => setActiveReviewItem(item)}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-emerald-400"
                  >
                    ⭐ Write review
                  </button>
                ) : null}

                {flags.writeEnabled && item.reviewState === 'ALREADY_REVIEWED' ? (
                  <button
                    type="button"
                    onClick={() => setActiveReviewItem(item)}
                    className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-200"
                  >
                    ✅ Edit review
                  </button>
                ) : null}

                {item.reviewState === 'BLOCKED_BY_DISPUTE' ? (
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                    🛑 Review paused while a sizing dispute is open.
                  </div>
                ) : null}

                {item.reviewState === 'NOT_DELIVERED' ? (
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    📦 Review unlocks after delivery.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <LazyOrderQrCard
        orderId={order.id}
        title="Order QR Code"
        subtitle="Scan to reopen this order while signed in."
        logoUrl={order.brand?.logo || null}
      />

      <ReviewComposerModal
        open={Boolean(activeReviewItem)}
        onClose={() => setActiveReviewItem(null)}
        orderItem={activeReviewItem}
        reviewId={activeReviewItem?.existingReviewId || null}
        onSaved={async () => {
          if (!orderId) return;
          const data = await getMyOrder(orderId);
          setOrder(data as any);
        }}
        onDeleted={async () => {
          if (!orderId) return;
          const data = await getMyOrder(orderId);
          setOrder(data as any);
        }}
      />
    </div>
  );
};

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

export default OrderDetail;
