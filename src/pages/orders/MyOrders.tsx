import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Package, Truck } from 'lucide-react';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';

const statusIcon = (status: string) => {
  switch (status) {
    case 'SHIPPED':
      return <Truck className="w-4 h-4" />;
    case 'DELIVERED':
      return <BadgeCheck className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
};

const statusTone = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-green-100 text-green-700';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const MyOrders: React.FC = () => {
  const navigate = useNavigate();
  const { flags, isLoading: reviewFlagsLoading } = useReviewRuntimeFlags();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyOrders(page, 10);
      const items = (res as any)?.items || (res as any)?.data || [];
      setOrders(items);
      setTotalPages((res as any)?.totalPages || 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load your orders');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Orders</h1>
          <p className="text-gray-500 text-sm">Track everything you have purchased.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Clock className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">You have not placed any orders yet.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono text-gray-800 dark:text-gray-200">#{order.id.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="font-medium text-lg">{order.customerName}</div>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                    {order.items.slice(0, 3).map((item) => (
                      <span key={item.productId} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        {item.name} × {item.quantity}
                      </span>
                    ))}
                    {order.items.length > 3 && <span className="text-gray-400">+{order.items.length - 3} more</span>}
                  </div>
                  {order.orderItems?.length ? (
                    <div className="space-y-2 pt-2">
                      {!reviewFlagsLoading && !flags.writeEnabled ? (
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Reviews are temporarily unavailable.
                        </div>
                      ) : null}
                      {order.orderItems.map((item) => (
                        <div key={item.orderItemId || item.id || `${order.id}-${item.productId}`} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-950/50">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {item.productName || item.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {[
                                  item.selectedSize ? `Size ${item.selectedSize}` : null,
                                  item.selectedColor ? `Color ${item.selectedColor}` : null,
                                ].filter(Boolean).join(' / ') || 'Purchase details available in order.'}
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
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusTone(order.status)}`}>
                    {statusIcon(order.status)}
                    {order.status}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: order.currency || 'NGN' }).format(Number(order.totalAmount))}
                    </div>
                    <button
                      className="text-sm text-black dark:text-white hover:underline"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      View details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
        <ReviewComposerModal
          open={Boolean(activeReviewItem)}
          onClose={() => setActiveReviewItem(null)}
          orderItem={activeReviewItem}
          reviewId={activeReviewItem?.existingReviewId || null}
          onSaved={async () => {
            await loadOrders();
          }}
          onDeleted={async () => {
            await loadOrders();
          }}
        />
    </div>
  );
};

export default MyOrders;
