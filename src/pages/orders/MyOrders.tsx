import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import VLoader from '@/components/loaders/VLoader';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import ImageWithFallback from '@/components/ImageWithFallback';

const statusIcon = (status: string) => {
  switch (status) {
    case 'SHIPPED':
      return '🚚';
    case 'DELIVERED':
      return '✅';
    case 'PROCESSING':
      return '🧵';
    default:
      return '📦';
  }
};

const statusTone = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300';
  }
};

const MyOrders: React.FC = () => {
  const navigate = useNavigate();
  const { flags } = useReviewRuntimeFlags();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);
  const [summaryByOrderId, setSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyOrders(page, 10);
      const items = (res as any)?.items || (res as any)?.data || [];
      setOrders(items);
      setTotalPages((res as any)?.totalPages || 1);

      const orderIds = items.map((item: Order) => item.id).filter(Boolean);
      if (orderIds.length > 0) {
        const summaries = await messagingApi.getBulkOrderSummaries(orderIds, true);
        setSummaryByOrderId(
          summaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
      } else {
        setSummaryByOrderId({});
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load your orders');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Orders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {!loading && orders.length > 0 ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'Track everything you have purchased.'}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <VLoader size={48} phase="loading" />
          <p className="mt-4 text-sm text-gray-500">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
            <span aria-hidden="true" className="text-3xl text-gray-400">📦</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No orders yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            When you make a purchase, your orders will appear here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
          >
            Start shopping
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const summary = summaryByOrderId[order.id];
            const unreadCount = Number(summary?.unreadCount ?? 0);
            const firstItem = order.items?.[0];
            const thumbnail = firstItem?.thumbnail || null;

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5">
                    {thumbnail ? (
                      <ImageWithFallback
                        src={thumbnail}
                        alt={firstItem?.name || 'Order'}
                        fit="cover"
                        rounded="xl"
                        className="h-full w-full object-cover"
                        containerClassName="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300 dark:text-gray-600">
                        <span aria-hidden="true">📦</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {order.items.map((i) => i.name).join(', ')}
                          </h3>
                          {unreadCount > 0 && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                              💬 {unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(Number(order.totalAmount), order.currency || 'NGN')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusTone(order.status)}`}>
                          <span aria-hidden="true">{statusIcon(order.status)}</span>
                          {order.status}
                        </div>
                        {order.items.length > 1 && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {order.items.length} items
                          </span>
                        )}
                        {order.paymentStatus !== 'PAID' && order.paymentReference && (
                          <button
                            className="text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/checkout/confirmation?reference=${encodeURIComponent(order.paymentReference!)}`);
                            }}
                          >
                            Resume payment
                          </button>
                        )}
                      </div>
                      <span aria-hidden="true" className="text-base text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400">›</span>
                    </div>
                  </div>
                </div>

                {/* Review actions */}
                {order.orderItems?.some((item) => item.reviewState === 'CAN_CREATE' || item.reviewState === 'ALREADY_REVIEWED') && flags.writeEnabled && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap gap-2">
                    {order.orderItems.filter((item) => item.reviewState === 'CAN_CREATE' || item.reviewState === 'ALREADY_REVIEWED').map((item) => (
                      <button
                        key={item.orderItemId || item.id || item.productId}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveReviewItem(item); }}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                          item.reviewState === 'CAN_CREATE'
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:text-gray-300'
                        }`}
                      >
                        {item.reviewState === 'CAN_CREATE' ? '⭐ Review' : '✅ Edit review'} {item.productName || item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
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
