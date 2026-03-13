import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMyOrder, resolveOrderAccess, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import LazyOrderQrCard from '@/components/qr/LazyOrderQrCard';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import ImageWithFallback from '@/components/ImageWithFallback';
import VLoader from '@/components/loaders/VLoader';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { flags, isLoading: reviewFlagsLoading } = useReviewRuntimeFlags();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);

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
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 flex justify-center">
        <VLoader size={56} phase="loading" />
      </div>
    );
  }

  if (!order) {
    return <div className="max-w-4xl mx-auto py-10 px-4">Order not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <button type="button" onClick={() => navigate(-1)} className="font-semibold transition-colors hover:text-black dark:hover:text-white">
          Back
        </button>
        <span>/</span>
        <button type="button" onClick={() => navigate('/orders')} className="transition-colors hover:text-black dark:hover:text-white">
          Orders
        </button>
        <span>/</span>
        <span className="font-medium text-gray-900 dark:text-white">#{order.id.slice(0, 8)}</span>
      </div>
      <div className="rounded-2xl border border-gray-200/80 bg-white/65 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800/80 dark:bg-white/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Order ID</p>
            <p className="font-mono text-lg">#{order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-xl font-semibold">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: order.currency || 'NGN',
              }).format(Number(order.totalAmount))}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Placed on {new Date(order.createdAt).toLocaleString()}
        </div>
        {order.paymentStatus !== 'PAID' && order.paymentReference ? (
          <div className="rounded-2xl border border-amber-300/70 px-4 py-4 text-sm text-amber-900 backdrop-blur-sm dark:border-amber-800/40 dark:text-amber-100">
            <p className="font-semibold">Payment still pending</p>
            <p className="mt-1">
              This order has a pending payment reference. You can reopen the payment flow and continue from where you stopped.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => navigate(`/checkout/confirmation?reference=${encodeURIComponent(order.paymentReference!)}`)}
                className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
              >
                Resume payment
              </button>
            </div>
          </div>
        ) : null}
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200/70 px-4 py-3 text-sm dark:border-gray-800/80">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
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
                    <div className="flex h-full w-full items-center justify-center text-base">📦</div>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="font-medium">{item.name}</p>
                  <div className="text-gray-500 flex gap-2 flex-wrap">
                  {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                  {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Qty {item.quantity}</p>
                <p className="font-medium">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: order.currency || 'NGN',
                  }).format(Number(item.price) * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {order.orderItems?.length ? (
          <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review status</div>
            {!reviewFlagsLoading && !flags.writeEnabled ? (
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Reviews are temporarily unavailable.
              </div>
            ) : null}
            {order.orderItems.map((item) => (
              <div key={item.orderItemId || item.id || item.productId} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.productName || item.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {[
                      item.selectedSize ? `Size ${item.selectedSize}` : null,
                      item.selectedColor ? `Color ${item.selectedColor}` : null,
                    ].filter(Boolean).join(' / ') || 'Review status attached to this order item.'}
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
      </div>

      <LazyOrderQrCard
        orderId={order.id}
        title="Order QR Code"
        subtitle="Scan to reopen this order while signed in."
        logoUrl={order.brand?.logo || null}
      />

      <OrderMessagesPanel
        contextType="STANDARD_ORDER"
        orderId={order.id}
        title="Order conversation"
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

export default OrderDetail;
