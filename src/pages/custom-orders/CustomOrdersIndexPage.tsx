import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  customOrdersBuyerApi,
  type CustomOrderListItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import {
  CustomOrderBadge,
  CustomOrderMetricCard,
  formatDateTime,
} from '@/components/custom-orders/CustomOrderUi';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const CustomOrdersIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await customOrdersBuyerApi.list({
          limit: 25,
          status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined,
        });
        if (!active) return;
        setOrders(response.items);
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load your custom orders');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const totals = useMemo(
    () => ({
      total: orders.length,
      active: orders.filter((entry) => ['PENDING_BRAND_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(entry.status)).length,
      disputed: orders.filter((entry) => entry.status === 'DISPUTED' || entry.status === 'DELIVERY_ISSUE_REPORTED').length,
    }),
    [orders],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Custom Orders</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">My custom orders</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Track payment, brand acceptance, delivery milestones, and any disputes from one queue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/custom-orders/new')}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
        >
          Start new custom order
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <CustomOrderMetricCard label="Total" value={totals.total} />
        <CustomOrderMetricCard label="Active" value={totals.active} />
        <CustomOrderMetricCard label="Needs attention" value={totals.disputed} />
      </div>

      <section className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Buyer queue</div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
            <option value="">All statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="PENDING_BRAND_ACCEPTANCE">Pending brand acceptance</option>
            <option value="IN_PRODUCTION">In production</option>
            <option value="DELIVERED_PENDING_BUYER_CONFIRMATION">Awaiting your confirmation</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading your custom orders...</div> : null}
          {!loading && orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No custom orders match this view yet.
            </div>
          ) : null}
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => navigate(`/custom-orders/${order.id}`)}
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-4 text-left transition hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{order.sourceTitle}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CustomOrderBadge value={order.status} />
                    <CustomOrderBadge value={order.paymentStatus} type="payment" />
                    <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Placed {formatDateTime(order.createdAt)} • {order.brand.name}
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CustomOrdersIndexPage;