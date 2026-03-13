import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import OrderDetailsModal from '@/components/dashboard/OrderDetailsModal';
import ImageWithFallback from '@/components/ImageWithFallback';
import VLoader from '@/components/loaders/VLoader';

type OrderLineItem = {
  id?: string;
  orderItemId?: string;
  quantity?: number;
  unitPrice?: number | string;
  totalPrice?: number | string;
  selectedSize?: string | null;
  selectedColor?: string | null;
  sizingMode?: string | null;
  requiredMeasurementKeys?: string[] | null;
  sizeFitSnapshot?: Record<string, unknown> | null;
  thumbnail?: string | null;
  name?: string | null;
  productName?: string | null;
};

type OrderRecord = {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  createdAt: string;
  totalAmount: number | string;
  currency: string;
  status: string;
  paymentStatus?: string | null;
  orderItems?: OrderLineItem[];
};

type OrdersSummary = {
  totalOrders: number;
  totalRevenue: number | string;
  pendingCount: number;
  processingCount: number;
  shippedCount: number;
  deliveredCount: number;
  cancelledCount: number;
  returnedCount: number;
};

const EMPTY_SUMMARY: OrdersSummary = {
  totalOrders: 0,
  totalRevenue: 0,
  pendingCount: 0,
  processingCount: 0,
  shippedCount: 0,
  deliveredCount: 0,
  cancelledCount: 0,
  returnedCount: 0,
};

const STATUS_TABS = [
  { label: 'All Orders', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Returns', value: 'RETURNED' },
] as const;

const SORT_OPTIONS = [
  { label: 'Newest', value: 'date-desc' },
  { label: 'Oldest', value: 'date-asc' },
  { label: 'Highest amount', value: 'amount-desc' },
  { label: 'Lowest amount', value: 'amount-asc' },
] as const;

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

const formatCompactCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);

const normalizeAmount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isLikelyFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

const getRelativeTime = (value?: string | null) => {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const getInitials = (name?: string | null) => {
  const cleaned = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '');

  return cleaned.join('') || '??';
};

const getStatusClasses = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'DELIVERED':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    case 'PENDING':
      return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
    case 'PROCESSING':
      return 'bg-blue-500/12 text-blue-700 dark:text-blue-300';
    case 'SHIPPED':
      return 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300';
    case 'CANCELLED':
      return 'bg-rose-500/12 text-rose-700 dark:text-rose-300';
    case 'RETURNED':
      return 'bg-orange-500/12 text-orange-700 dark:text-orange-300';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
};

const getPaymentClasses = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'PAID':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    case 'FAILED':
      return 'bg-rose-500/12 text-rose-700 dark:text-rose-300';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
};

const summarizeOrderFit = (order: OrderRecord) => {
  const lineItems = Array.isArray(order.orderItems) ? order.orderItems : [];
  const firstItem = lineItems[0];
  const requiredCount = lineItems.reduce((count, item) => {
    const keys = Array.isArray(item.requiredMeasurementKeys) ? item.requiredMeasurementKeys.length : 0;
    return count + keys;
  }, 0);

  const usesCustomSizing = lineItems.some((item) => {
    const mode = String(item.sizingMode || '').toUpperCase();
    return mode.includes('CUSTOM') || mode.includes('MEASUREMENT') || requiredCount > 0;
  });

  const detailParts = [
    firstItem?.selectedSize ? `Size ${firstItem.selectedSize}` : null,
    firstItem?.selectedColor ? `Color ${firstItem.selectedColor}` : null,
  ].filter(Boolean);

  return {
    primaryName: firstItem?.productName || firstItem?.name || 'Order item',
    detailLine: detailParts.join(' · '),
    sizingLabel: usesCustomSizing ? 'Custom Size Profile' : 'Standard Fit',
    usesCustomSizing,
    measurementCount: requiredCount,
  };
};

const getPreviewItems = (order: OrderRecord) => (Array.isArray(order.orderItems) ? order.orderItems.slice(0, 2) : []);

const metricProgress = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(6, Math.round((value / total) * 100)));
};

const buildCsv = (orders: OrderRecord[]) => {
  const rows = orders.map((order) => {
    const fit = summarizeOrderFit(order);
    return [
      order.id,
      order.customerName,
      order.customerEmail || '',
      order.status,
      order.paymentStatus || '',
      normalizeAmount(order.totalAmount).toFixed(2),
      order.currency,
      fit.primaryName,
      fit.detailLine,
      fit.sizingLabel,
      new Date(order.createdAt).toISOString(),
    ];
  });

  return [
    ['order_id', 'customer_name', 'customer_email', 'status', 'payment_status', 'total_amount', 'currency', 'primary_item', 'item_details', 'fit_type', 'created_at'],
    ...rows,
  ]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

const downloadCsv = (orders: OrderRecord[]) => {
  const csv = buildCsv(orders);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `threadly-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const OrderManagement: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedOrder, setSelectedOrder] = useState<{ id: string } | null>(null);

  const preselectedOrderId = searchParams.get('orderId');

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await brandApi.getOrders(user.id, {
        page,
        limit: 10,
        status: statusFilter,
        q: searchQuery,
      });

      if (data) {
        setOrders(Array.isArray(data.items) ? data.items : []);
        setSummary(data.summary || EMPTY_SUMMARY);
        setTotalPages(Number(data.totalPages || data.meta?.totalPages || 1));
      } else {
        setOrders([]);
        setSummary(EMPTY_SUMMARY);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setOrders([]);
      setSummary(EMPTY_SUMMARY);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, user?.id]);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      void fetchOrders();
    }, 300);

    return () => window.clearTimeout(debounce);
  }, [fetchOrders]);

  useEffect(() => {
    if (!preselectedOrderId) return;
    setSelectedOrder({ id: preselectedOrderId });
  }, [preselectedOrderId]);

  const sortedOrders = useMemo(() => {
    const next = [...orders];
    next.sort((left, right) => {
      if (sortBy === 'date-asc') {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }
      if (sortBy === 'amount-desc') {
        return normalizeAmount(right.totalAmount) - normalizeAmount(left.totalAmount);
      }
      if (sortBy === 'amount-asc') {
        return normalizeAmount(left.totalAmount) - normalizeAmount(right.totalAmount);
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    return next;
  }, [orders, sortBy]);

  const metrics = useMemo(
    () => [
      {
        label: 'Total Revenue',
        value: formatCompactCurrency(normalizeAmount(summary.totalRevenue), 'NGN'),
        tone: 'text-orange-500',
        progress: 78,
        marker: '💳',
        helper: `${summary.totalOrders} live orders`,
      },
      {
        label: 'Pending',
        value: String(summary.pendingCount),
        tone: 'text-amber-500',
        progress: metricProgress(summary.pendingCount, summary.totalOrders),
        marker: '⏳',
        helper: 'Awaiting action',
      },
      {
        label: 'Processing',
        value: String(summary.processingCount),
        tone: 'text-blue-500',
        progress: metricProgress(summary.processingCount, summary.totalOrders),
        marker: '🧵',
        helper: 'Currently in production',
      },
      {
        label: 'Delivered',
        value: String(summary.deliveredCount),
        tone: 'text-emerald-500',
        progress: metricProgress(summary.deliveredCount, summary.totalOrders),
        marker: '✅',
        helper: 'Completed successfully',
      },
    ],
    [summary],
  );

  const handleCloseOrderDetails = () => {
    setSelectedOrder(null);
    if (!preselectedOrderId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('orderId');
    setSearchParams(next, { replace: true });
  };

  const handleStatusChipClick = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const cycleSort = () => {
    const currentIndex = SORT_OPTIONS.findIndex((option) => option.value === sortBy);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SORT_OPTIONS.length : 0;
    setSortBy(SORT_OPTIONS[nextIndex].value);
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      <section className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">
            <span>Studio</span>
            <span>/</span>
            <span className="text-orange-500">Orders</span>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Order Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              Monitor, fulfill, and review production-critical order metadata from one branded control surface.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => downloadCsv(sortedOrders)}
            className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-orange-500/40 dark:hover:text-white"
          >
            ⭳ Export CSV
          </button>
          <button
            type="button"
            disabled
            className="rounded-2xl bg-[linear-gradient(135deg,#f97316,#c2410c)] px-5 py-2 text-sm font-semibold text-white opacity-75 shadow-[0_18px_40px_rgba(249,115,22,0.22)]"
            title="Manual order creation is not implemented yet"
          >
            ＋ Create Manual Order
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:border-orange-300/60 dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] dark:shadow-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-4 text-2xl font-black tracking-tight">{metric.value}</p>
              </div>
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/5 text-xl dark:bg-white/5 ${metric.tone}`}>
                {metric.marker}
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-500">{metric.helper}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/5">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#f97316,#ea580c)]" style={{ width: `${metric.progress}%` }} />
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full items-center gap-2 overflow-x-auto pb-2 scrollbar-hide xl:w-auto xl:pb-0">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleStatusChipClick(tab.value)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-slate-200 bg-white/80 text-slate-500 hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <input
            type="text"
            placeholder="Search by order ID or customer name..."
            className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 xl:w-80"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter by order status"
            className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="RETURNED">Returned</option>
          </select>
          <button
            type="button"
            onClick={cycleSort}
            className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-white"
            aria-label="Cycle order sort"
          >
            Sort by: {SORT_OPTIONS.find((option) => option.value === sortBy)?.label || 'Newest'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(255,255,255,0.78))] shadow-[0_24px_60px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.03]">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Order ID</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Customer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Items</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Details</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Payment</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Amount</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex justify-center">
                      <VLoader size={56} progress={58} phase="loading" />
                    </div>
                  </td>
                </tr>
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const fit = summarizeOrderFit(order);
                  const previews = getPreviewItems(order);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder({ id: order.id })}
                      className="cursor-pointer border-b border-slate-200/70 transition hover:bg-slate-100/70 dark:border-white/6 dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-6 py-4 align-top">
                        <p className="font-mono text-sm font-semibold tracking-tight text-orange-600 dark:text-orange-400">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{getRelativeTime(order.createdAt)}</p>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-xs font-black text-orange-600 dark:text-orange-300">
                            {getInitials(order.customerName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{order.customerName}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-500">{order.customerEmail || 'No email captured'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          {previews.length > 0 ? (
                            previews.map((item, index) => (
                              (() => {
                                const thumbnail = item.thumbnail || undefined;
                                const fileId = isLikelyFileId(thumbnail) ? thumbnail : undefined;
                                const src = fileId ? undefined : thumbnail;

                                return (
                                  <div
                                    key={item.orderItemId || item.id || `${order.id}-${index}`}
                                    className={`h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 ${index > 0 ? '-ml-4' : ''}`}
                                  >
                                    <ImageWithFallback
                                      src={src}
                                      fileId={fileId}
                                      alt={item.productName || item.name || 'Order item'}
                                      fit="cover"
                                      rounded="xl"
                                      className="h-full w-full object-cover"
                                      containerClassName="h-full w-full"
                                    />
                                  </div>
                                );
                              })()
                            ))
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm dark:border-white/10 dark:bg-white/5">
                              🧵
                            </div>
                          )}

                          {Array.isArray(order.orderItems) && order.orderItems.length > 2 ? (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-500">
                              +{order.orderItems.length - 2} item{order.orderItems.length - 2 === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <p className="max-w-[240px] truncate text-sm text-slate-700 dark:text-slate-200">{fit.primaryName}</p>
                        {fit.detailLine ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{fit.detailLine}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${fit.usesCustomSizing ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>
                            {fit.sizingLabel}
                          </span>
                          {fit.measurementCount > 0 ? (
                            <span className="inline-flex rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700 dark:text-orange-300">
                              {fit.measurementCount} points
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClasses(order.status)}`}>
                          {order.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentClasses(order.paymentStatus)}`}>
                          {order.paymentStatus || 'PENDING'}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <p className="text-sm font-black">{formatCurrency(normalizeAmount(order.totalAmount), order.currency)}</p>
                      </td>

                      <td className="px-6 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOrder({ id: order.id });
                          }}
                          className="rounded-xl border border-transparent px-3 py-2 text-lg leading-none text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                          aria-label={`View order ${order.id}`}
                        >
                          ...
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200/80 px-6 py-4 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-500 dark:text-slate-500">
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{sortedOrders.length === 0 ? 0 : (page - 1) * 10 + 1} - {(page - 1) * 10 + sortedOrders.length}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary.totalOrders}</span> orders
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-sm font-bold text-slate-500 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {'<'}
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => {
                const targetPage = index + 1;
                const active = page === targetPage;
                return (
                  <button
                    key={targetPage}
                    type="button"
                    onClick={() => setPage(targetPage)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                      active
                        ? 'bg-orange-500 text-white'
                        : 'border border-slate-200 bg-white/80 text-slate-500 hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {targetPage}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-sm font-bold text-slate-500 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {'>'}
            </button>
          </div>
        </div>
      </section>

      {selectedOrder && user?.id ? (
        <OrderDetailsModal
          isOpen={Boolean(selectedOrder)}
          onClose={handleCloseOrderDetails}
          orderId={selectedOrder.id}
          brandId={user.id}
          onStatusUpdate={fetchOrders}
        />
      ) : null}
    </div>
  );
};

export default OrderManagement;