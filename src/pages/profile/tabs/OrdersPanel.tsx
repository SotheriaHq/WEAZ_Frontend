import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { getMyOrders, type Order } from '@/api/StoreApi';

/* ------------------------------------------------------------------ */
/*  OrdersPanel – Premium sidebar panel for the end-user profile      */
/* ------------------------------------------------------------------ */

interface OrdersPanelProps {
  enabled: boolean;
}

const STATUS_OPTIONS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700/40', dot: 'bg-amber-400' },
  PROCESSING: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700/40', dot: 'bg-blue-400' },
  SHIPPED: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700/40', dot: 'bg-indigo-400' },
  DELIVERED: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700/40', dot: 'bg-emerald-400' },
  CANCELLED: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700/40', dot: 'bg-rose-400' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  PROCESSING: <Package className="h-3 w-3" />,
  SHIPPED: <Truck className="h-3 w-3" />,
  DELIVERED: <CheckCircle2 className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
};

const FALLBACK_STYLE = { bg: 'bg-gray-50 dark:bg-white/5', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-200 dark:border-white/10', dot: 'bg-gray-400' };

/* ---- Step progress ---- */
const PROGRESS_STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const StepProgress: React.FC<{ status: string }> = ({ status }) => {
  const activeIdx = PROGRESS_STEPS.indexOf(status as typeof PROGRESS_STEPS[number]);
  const isCancelled = status === 'CANCELLED';

  return (
    <div className="flex items-center gap-0.5" aria-label={`Order status: ${status.toLowerCase()}`}>
      {PROGRESS_STEPS.map((step, idx) => {
        const filled = !isCancelled && idx <= activeIdx;
        return (
          <React.Fragment key={step}>
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                isCancelled
                  ? 'bg-rose-300 dark:bg-rose-700'
                  : filled
                    ? 'bg-indigo-500 dark:bg-indigo-400'
                    : 'bg-gray-200 dark:bg-white/10'
              }`}
              title={step.toLowerCase()}
            />
            {idx < PROGRESS_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-3 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                  isCancelled
                    ? 'bg-rose-200 dark:bg-rose-800'
                    : !isCancelled && idx < activeIdx
                      ? 'bg-indigo-400 dark:bg-indigo-500'
                      : 'bg-gray-200 dark:bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ---- Helpers ---- */
const normalizeStatus = (value: string | undefined): string => {
  if (!value) return 'UNKNOWN';
  return value.trim().toUpperCase().replace(/\s+/g, '_');
};

const formatCurrency = (amount: number, currency: string): string => {
  const safeCurrency = currency && currency.length === 3 ? currency : 'NGN';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${safeCurrency} ${amount ?? 0}`;
  }
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const summarizeItems = (items: { name: string; quantity: number }[]): string => {
  if (!items || items.length === 0) return 'No items';
  const first = `${items[0].name} × ${items[0].quantity}`;
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} more`;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const OrdersPanel: React.FC<OrdersPanelProps> = ({ enabled }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setError(null);
      return;
    }

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
  }, [enabled]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      const normalized = normalizeStatus(order.status);
      const statusMatch = status === 'ALL' || normalized === status;
      if (!statusMatch) return false;

      if (!needle) return true;
      const terms = [
        order.id,
        order.customerName,
        ...(Array.isArray(order.items) ? order.items.map((item) => item.name) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.includes(needle);
    });
  }, [orders, query, status]);

  const orderCountByStatus = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      ALL: orders.length,
      PENDING: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    for (const order of orders) {
      const normalized = normalizeStatus(order.status) as StatusFilter;
      if (normalized in base) base[normalized] += 1;
    }
    return base;
  }, [orders]);

  if (!enabled) return null;

  return (
    <aside className="md:sticky md:top-24 md:self-start rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-black/20 backdrop-blur-lg shadow-lg overflow-hidden">
      {/* Gradient accent line */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400" />

      {/* ---- Header ---- */}
      <div className="p-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Orders</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Your order timeline</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/50 dark:bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* ---- Collapsible Filters ---- */}
        <div
          className={`overflow-hidden transition-all duration-200 motion-reduce:transition-none ${
            filtersOpen ? 'max-h-[260px] mt-3' : 'max-h-0'
          }`}
        >
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search orders…"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
              spellCheck={false}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  status === opt
                    ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                    : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
              >
                {opt === 'ALL' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase()}
                <span className="ml-1 tabular-nums opacity-70">{orderCountByStatus[opt]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Order List ---- */}
      <div className="max-h-[58vh] overflow-y-auto scrollbar-hide p-3 space-y-2">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-[100px] rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/5 dark:to-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-300">
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">No orders yet</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {query || status !== 'ALL' ? 'Try adjusting your filters.' : 'Your orders will appear here once you start shopping.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const normalizedStatus = normalizeStatus(order.status);
            const style = STATUS_STYLES[normalizedStatus] ?? FALLBACK_STYLE;
            const icon = STATUS_ICONS[normalizedStatus] ?? <Package className="h-3 w-3" />;

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/orders/${order.id}`)}
                className="group w-full rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-3.5 text-left backdrop-blur-sm transition-all duration-200 motion-reduce:transition-none hover:border-indigo-300/70 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {/* Row 1: ID + Status badge */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                    Order #{order.id.slice(0, 8)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
                  >
                    {icon}
                    {normalizedStatus.toLowerCase()}
                  </span>
                </div>

                {/* Row 2: Item summary */}
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {summarizeItems(Array.isArray(order.items) ? order.items : [])}
                </p>

                {/* Row 3: Step progress */}
                <div className="mt-2.5">
                  <StepProgress status={normalizedStatus} />
                </div>

                {/* Row 4: Date + Amount */}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {formatDate(order.createdAt)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
