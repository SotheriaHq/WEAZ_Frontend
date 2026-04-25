import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMyOrders, type Order } from '@/api/StoreApi';
import { customOrdersBuyerApi, type CustomOrderListItem } from '@/api/CustomOrderApi';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import UniversalSelect from '@/components/forms/UniversalSelect';
import VLoader from '@/components/loaders/VLoader';
import ReviewComposerModal from '@/components/reviews/ReviewComposerModal';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import { CustomOrderBadge, formatDateTime } from '@/components/custom-orders/CustomOrderUi';
import { formatCustomOrderCode } from '@/components/custom-orders/customOrderFormatting';

type BuyerOrderTab = 'all' | 'active' | 'awaiting' | 'completed' | 'cancelled';
type OrdersView = 'standard' | 'custom';

const standardTabs: Array<{ key: BuyerOrderTab; label: string }> = [
  { key: 'all', label: 'All orders' },
  { key: 'active', label: 'In progress' },
  { key: 'awaiting', label: 'Action needed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const standardStatusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PENDING', label: 'Pending' },
];

const customStatusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'PENDING_BRAND_ACCEPTANCE', label: 'Pre-production hold' },
  { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for dispatch' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED_PENDING_BUYER_CONFIRMATION', label: 'Awaiting confirmation' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

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

const StatCard: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const MyOrders: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { flags } = useReviewRuntimeFlags();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrderListItem[]>([]);
  const [summaryByOrderId, setSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});
  const [customSummaryByOrderId, setCustomSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ordersView, setOrdersView] = useState<OrdersView>('standard');
  const [activeTab, setActiveTab] = useState<BuyerOrderTab>('all');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStatusFilter, setCustomStatusFilter] = useState('ALL');
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const deferredCustomSearchQuery = useDeferredValue(customSearchQuery);
  const [activeReviewItem, setActiveReviewItem] = useState<any | null>(null);

  useEffect(() => {
    const paymentFailureReason =
      (location.state as { paymentFailureReason?: string } | null)
        ?.paymentFailureReason;
    if (!paymentFailureReason) {
      return;
    }

    toast.error(paymentFailureReason);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [standardResult, customResult] = await Promise.allSettled([
        getMyOrders(page, 10),
        customOrdersBuyerApi.list({ limit: 25 }),
      ]);

      if (standardResult.status !== 'fulfilled') {
        throw standardResult.reason;
      }

      const standardItems = (standardResult.value as any)?.items || (standardResult.value as any)?.data || [];
      setOrders(standardItems);
      setTotalPages((standardResult.value as any)?.totalPages || 1);

      if (customResult.status === 'fulfilled') {
        setCustomOrders(customResult.value.items);
      } else {
        setCustomOrders([]);
      }

      const orderIds = standardItems.map((item: Order) => item.id).filter(Boolean);
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

      const customIds = customResult.status === 'fulfilled' ? customResult.value.items.map((item) => item.id) : [];
      if (customIds.length > 0) {
        const summaries = await messagingApi.getBulkCustomOrderSummaries(customIds, true);
        setCustomSummaryByOrderId(
          summaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
      } else {
        setCustomSummaryByOrderId({});
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

  const standardStats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => ['PROCESSING', 'SHIPPED'].includes(order.status)).length,
    actionNeeded: orders.filter((order) => order.paymentStatus !== 'PAID' || order.status === 'SHIPPED').length,
    completed: orders.filter((order) => order.status === 'DELIVERED').length,
  }), [orders]);

  const customStats = useMemo(() => ({
    total: customOrders.length,
    active: customOrders.filter((order) => ['PENDING_BRAND_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(order.status)).length,
    awaiting: customOrders.filter((order) => order.paymentStatus !== 'PAID').length,
    disputed: customOrders.filter((order) => order.status === 'DISPUTED' || order.status === 'DELIVERY_ISSUE_REPORTED').length,
  }), [customOrders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = statusFilter === 'ALL' || (statusFilter === 'PENDING' ? order.paymentStatus !== 'PAID' : order.status === statusFilter);
      const tabMatch =
        activeTab === 'all' ||
        (activeTab === 'active' && ['PROCESSING', 'SHIPPED'].includes(order.status)) ||
        (activeTab === 'awaiting' && (order.paymentStatus !== 'PAID' || order.status === 'SHIPPED')) ||
        (activeTab === 'completed' && order.status === 'DELIVERED') ||
        (activeTab === 'cancelled' && order.status === 'CANCELLED');
      const text = [order.id, order.status, order.items?.map((item) => item.name).join(' ')].filter(Boolean).join(' ').toLowerCase();
      return statusMatch && tabMatch && (query.length === 0 || text.includes(query));
    });
  }, [activeTab, orders, searchQuery, statusFilter]);

  const filteredCustomOrders = useMemo(() => {
    const query = deferredCustomSearchQuery.trim().toLowerCase();
    return customOrders.filter((order) => {
      const statusMatch = customStatusFilter === 'ALL' || order.status === customStatusFilter;
      const text = [order.id, order.status, order.sourceTitle, order.brand.name, order.currentProgressStage].filter(Boolean).join(' ').toLowerCase();
      return statusMatch && (query.length === 0 || text.includes(query));
    });
  }, [customOrders, customStatusFilter, deferredCustomSearchQuery]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-black dark:text-gray-300 dark:hover:text-white">
          <span aria-hidden="true">←</span>
          Back
        </button>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
          <Link to="/" className="transition-colors hover:text-black dark:hover:text-white">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Orders</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Your Orders</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track standard purchases and custom requests from one workspace.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap gap-2">
          {['standard', 'custom'].map((tab) => {
            const isActive = ordersView === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setOrdersView(tab as OrdersView)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
              >
                {tab === 'standard' ? 'Standard Orders' : 'Custom Orders'}
              </button>
            );
          })}
        </div>
      </section>

      {!loading && ordersView === 'standard' ? (
        <>
          {orders.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total orders" value={standardStats.total} tone="border border-gray-200 bg-white text-gray-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
                <StatCard label="In progress" value={standardStats.active} tone="border border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200" />
                <StatCard label="Action needed" value={standardStats.actionNeeded} tone="border border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" />
                <StatCard label="Completed" value={standardStats.completed} tone="border border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" />
              </div>
              <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap gap-2">
                  {standardTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab.key ? 'bg-black text-white dark:bg-white dark:text-black' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by order id or item name" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
                  <UniversalSelect value={statusFilter} onChange={setStatusFilter} options={standardStatusOptions} />
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {!loading && ordersView === 'custom' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Custom orders" value={customStats.total} tone="border border-gray-200 bg-white text-gray-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
            <StatCard label="In progress" value={customStats.active} tone="border border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200" />
            <StatCard label="Awaiting payment" value={customStats.awaiting} tone="border border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" />
            <StatCard label="Needs attention" value={customStats.disputed} tone="border border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200" />
          </div>
          <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Custom order queue</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Open your made-to-measure workspaces, check messages, and follow delivery without leaving this page.</p>
              </div>
              <button type="button" onClick={() => navigate('/custom-orders/new')} className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
                Start custom order
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <input value={customSearchQuery} onChange={(event) => setCustomSearchQuery(event.target.value)} placeholder="Search by code, title, stage, or brand" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950" />
              <UniversalSelect value={customStatusFilter} onChange={setCustomStatusFilter} options={customStatusOptions} />
            </div>
          </section>
        </>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <VLoader size={48} phase="loading" />
          <p className="mt-4 text-sm text-gray-500">Loading orders...</p>
        </div>
      ) : null}

      {!loading && ordersView === 'standard' && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
            <span aria-hidden="true" className="text-3xl text-gray-400">📦</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No orders yet</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">When you make a purchase, your orders will appear here.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-4 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
            Start shopping
          </button>
        </div>
      ) : null}

      {!loading && ordersView === 'custom' && customOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
            <span aria-hidden="true" className="text-3xl text-gray-400">🧵</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No custom orders yet</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Your made-to-measure orders will appear here once you place one.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-4 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
            Start shopping
          </button>
        </div>
      ) : null}

      {!loading && ordersView === 'standard' && filteredOrders.length === 0 && orders.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No orders match your current filters.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try a different tab, clear your search, or switch the status filter.</p>
        </div>
      ) : null}

      {!loading && ordersView === 'custom' && filteredCustomOrders.length === 0 && customOrders.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No custom orders match your current filters.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try another status filter or search by order code, title, or brand.</p>
        </div>
      ) : null}

      {!loading && ordersView === 'standard' ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const summary = summaryByOrderId[order.id];
            const unreadCount = Number(summary?.unreadCount ?? 0);
            const firstItem = order.items?.[0];
            const thumbnail = firstItem?.thumbnail || null;

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                    {thumbnail ? (
                      <ImageWithFallback
                        src={thumbnail}
                        alt={firstItem?.name || 'Order'}
                        fit="cover"
                        rounded="xl"
                        className="h-full w-full object-cover"
                        containerClassName="h-full w-full"
                        maxHeightClassName="max-h-20"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300 dark:text-gray-600">
                        <span aria-hidden="true">📦</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{order.items.map((item) => item.name).join(', ')}</h3>
                          {unreadCount > 0 ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              💬 {unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(order.totalAmount), order.currency || 'NGN')}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(order.status)}`}>
                          <span aria-hidden="true">{statusIcon(order.status)}</span>
                          {order.status}
                        </div>
                        {order.items.length > 1 ? <span className="text-[11px] text-gray-400 dark:text-gray-500">{order.items.length} items</span> : null}
                        {order.paymentStatus !== 'PAID' && order.paymentReference ? (
                          <button
                            className="text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/bag/confirmation?reference=${encodeURIComponent(order.paymentReference!)}`);
                            }}
                          >
                            Resume payment
                          </button>
                        ) : null}
                      </div>
                      <span aria-hidden="true" className="text-base text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400">›</span>
                    </div>
                  </div>
                </div>

                {order.orderItems?.some((item) => item.reviewState === 'CAN_CREATE' || item.reviewState === 'ALREADY_REVIEWED') && flags.writeEnabled ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
                    {order.orderItems
                      .filter((item) => item.reviewState === 'CAN_CREATE' || item.reviewState === 'ALREADY_REVIEWED')
                      .map((item) => (
                        <button
                          key={item.orderItemId || item.id || item.productId}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveReviewItem(item);
                          }}
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
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && ordersView === 'custom' ? (
        <div className="space-y-3">
          {filteredCustomOrders.map((order) => {
            const summary = customSummaryByOrderId[order.id];
            const unreadCount = Number(summary?.unreadCount ?? 0);

            return (
              <div
                key={order.id}
                onClick={() =>
                  navigate(`/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(order.id)}`)
                }
                className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                    {order.sourcePrimaryMediaUrl ? (
                      <ImageWithFallback
                        src={order.sourcePrimaryMediaUrl}
                        alt={order.sourceTitle}
                        fallbackName={order.sourceTitle}
                        fit="cover"
                        rounded="xl"
                        className="h-full w-full object-cover"
                        containerClassName="h-full w-full"
                        maxHeightClassName="max-h-20"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300 dark:text-gray-600">
                        <span aria-hidden="true">🧵</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{order.sourceTitle}</h3>
                          {summary?.hasUnread ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              💬 {unreadCount > 0 ? unreadCount : 'new'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {formatCustomOrderCode(order.id)} · {order.brand.name} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}</div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{order.measurementCount ?? 0} measurements</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CustomOrderBadge value={order.status} />
                        <CustomOrderBadge value={order.paymentStatus} type="payment" />
                        <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                      </div>
                      <span aria-hidden="true" className="text-base text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400">›</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && ordersView === 'standard' && totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-gray-200 px-4 py-2 font-medium transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5" disabled={page === 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}>
              Previous
            </button>
            <button className="rounded-xl border border-gray-200 px-4 py-2 font-medium transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5" disabled={page >= totalPages} onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}>
              Next
            </button>
          </div>
        </div>
      ) : null}

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
