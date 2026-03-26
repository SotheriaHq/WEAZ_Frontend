import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import VLoader from '@/components/loaders/VLoader';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import UniversalSelect from '@/components/forms/UniversalSelect';

type BuyerOrderTab = 'all' | 'active' | 'awaiting' | 'completed' | 'cancelled';

const tabConfig: Array<{ key: BuyerOrderTab; label: string }> = [
  { key: 'all', label: 'All orders' },
  { key: 'active', label: 'In progress' },
  { key: 'awaiting', label: 'Action needed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusFilterOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PENDING', label: 'Pending' },
];

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
  const [activeTab, setActiveTab] = useState<BuyerOrderTab>('all');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
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

  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((order) => ['PROCESSING', 'SHIPPED'].includes(order.status)).length;
    const actionNeeded = orders.filter(
      (order) => order.paymentStatus !== 'PAID' || order.status === 'SHIPPED',
    ).length;
    const completed = orders.filter((order) => order.status === 'DELIVERED').length;

    return { total, active, actionNeeded, completed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const statusMatch =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING'
          ? order.paymentStatus !== 'PAID'
          : order.status === statusFilter);

      const tabMatch =
        activeTab === 'all' ||
        (activeTab === 'active' && ['PROCESSING', 'SHIPPED'].includes(order.status)) ||
        (activeTab === 'awaiting' && (order.paymentStatus !== 'PAID' || order.status === 'SHIPPED')) ||
        (activeTab === 'completed' && order.status === 'DELIVERED') ||
        (activeTab === 'cancelled' && order.status === 'CANCELLED');

      const searchableText = [
        order.id,
        order.status,
        order.items?.map((item) => item.name).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const queryMatch = query.length === 0 || searchableText.includes(query);

      return statusMatch && tabMatch && queryMatch;
    });
  }, [activeTab, orders, searchQuery, statusFilter]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Orders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Track, manage, and follow updates for everything you have purchased.
        </p>
      </div>

      {!loading && orders.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total orders</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">In progress</p>
            <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Action needed</p>
            <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">{stats.actionNeeded}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Completed</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">{stats.completed}</p>
          </div>
        </div>
      ) : null}

      {!loading && orders.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap gap-2">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by order id or item name"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
            />
            <UniversalSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
            />
          </div>
        </div>
      ) : null}

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
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No orders match your current filters.</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try a different tab, clear your search, or switch the status filter.</p>
            </div>
          ) : null}

          {filteredOrders.map((order) => {
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
                      <div className="flex items-center gap-2">
                        {order.status === 'SHIPPED' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            📬 Confirm receipt in details
                          </span>
                        ) : null}
                        <span aria-hidden="true" className="text-base text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400">›</span>
                      </div>
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
