import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { getMyOrders, type Order } from '@/api/StoreApi';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

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

export const OrdersPanel: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getMyOrders(1, 50);
        if (!mounted) return;
        setOrders(Array.isArray(response?.items) ? response.items : []);
      } catch (err) {
        if (!mounted) return;
        setOrders([]);
        setError('Unable to load orders right now.');
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

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      const normalized = normalizeStatus(order.status);
      const statusMatch = status === 'ALL' || normalized === status;
      if (!statusMatch) return false;

      if (!needle) return true;
      const searchable = [
        order.id,
        order.customerName,
        ...(Array.isArray(order.items) ? order.items.map((item) => item.name) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(needle);
    });
  }, [orders, query, status]);

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Orders</h3>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="text-xs font-bold uppercase tracking-wide text-fuchsia-600 transition hover:text-gray-900 dark:text-fuchsia-300 dark:hover:text-white"
          >
            View All
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-2xl border border-gray-200/80 bg-white/70 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white/70 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          {STATUS_OPTIONS.map((opt) => {
            const active = status === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
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
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-gray-200/70 bg-white/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 text-2xl">
                ✨
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">Your order history is empty</h4>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {query || status !== 'ALL'
                  ? 'No orders match your current filters.'
                  : 'Your orders will appear here once you start shopping the latest drops.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/market')}
                className="mt-4 text-sm font-bold text-fuchsia-600 transition hover:text-gray-900 dark:text-fuchsia-300 dark:hover:text-white"
              >
                Start Browsing ›
              </button>
            </div>
          ) : (
            filteredOrders.slice(0, 6).map((order) => {
              const normalizedStatus = normalizeStatus(order.status);
              const completedSegments = progressSegments(normalizedStatus);
              const firstItem = order.items?.[0];

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="w-full rounded-2xl border border-gray-200/70 bg-white/60 p-3 text-left transition hover:border-fuchsia-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                      #ORD-{order.id.slice(0, 4).toUpperCase()}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                        normalizedStatus,
                      )}`}
                    >
                      {normalizedStatus === 'DELIVERED'
                        ? '✅ Delivered'
                        : normalizedStatus === 'SHIPPED'
                          ? '🚚 Shipped'
                          : normalizedStatus === 'CANCELLED'
                            ? '❌ Cancelled'
                            : normalizedStatus === 'PROCESSING'
                              ? '📦 Processing'
                              : '🕐 Pending'}
                    </span>
                  </div>

                  <div className="mb-3 flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
                      {firstItem?.thumbnail ? (
                        <img
                          src={firstItem.thumbnail}
                          alt={firstItem.name || 'Order item'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base">📦</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {firstItem?.name || 'Order'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</p>
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
          )}
        </div>
      </section>

      {orders.length > 0 ? (
        <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-5 text-center backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <span className="mb-2 block text-2xl">✨</span>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">Threadly Pro</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Unlock exclusive drops &amp; 0% fees.</p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Upgrade Now
          </button>
        </section>
      ) : (
        <section className="glass-panel rounded-3xl border border-gray-200/70 bg-white/70 p-5 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-lg">
            🛡️
          </div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">Buyer Protection</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Every purchase on Threadly is covered by our authenticity guarantee.
          </p>
        </section>
      )}
    </aside>
  );
};
