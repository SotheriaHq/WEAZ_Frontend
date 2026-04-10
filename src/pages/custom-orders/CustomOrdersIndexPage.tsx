import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  customOrdersBuyerApi,
  type CustomOrderListItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import {
  CustomOrderBadge,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import {
  formatCustomOrderCode,
} from '@/components/custom-orders/customOrderFormatting';
import UniversalSelect from '@/components/forms/UniversalSelect';
import ImageWithFallback from '@/components/ImageWithFallback';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'PENDING_BRAND_ACCEPTANCE', label: 'Pre-production hold' },
  { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'DELIVERED_PENDING_BUYER_CONFIRMATION', label: 'Awaiting your confirmation' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const cardTone = (status: CustomOrderStatus) => {
  if (status === 'DISPUTED' || status === 'DELIVERY_ISSUE_REPORTED') {
    return 'border-rose-300/70 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10';
  }

  if (status === 'PENDING_PAYMENT' || status === 'PENDING_BRAND_ACCEPTANCE') {
    return 'border-amber-300/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
  }

  return 'border-black/10 bg-white/85 dark:border-white/10 dark:bg-white/[0.04]';
};

const BuyerCustomOrderCard: React.FC<{
  order: CustomOrderListItem;
  summary: ThreadSummaryResponse | null | undefined;
  onOpenOrder: () => void;
  onOpenChat: () => void;
}> = ({ order, summary, onOpenOrder, onOpenChat }) => {
  const unreadCount = Number(summary?.unreadCount ?? 0);

  return (
    <article className={`overflow-hidden rounded-[1.8rem] border p-4 transition hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)] ${cardTone(order.status)}`}>
      <div className="grid gap-5 xl:grid-cols-[180px_1fr_auto] xl:items-start">
        <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.06]">
          {order.sourcePrimaryMediaUrl ? (
            <ImageWithFallback
              src={order.sourcePrimaryMediaUrl}
              alt={order.sourceTitle}
              fallbackName={order.sourceTitle}
              fit="cover"
              rounded="none"
              containerClassName="h-[180px] w-full overflow-hidden"
              className="h-[180px] w-full"
              maxHeightClassName="max-h-[180px]"
            />
          ) : (
            <div className="flex h-[180px] items-center justify-center bg-slate-950 text-7xl text-white">
              <span aria-hidden="true">🧵</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CustomOrderBadge value={order.status} />
            <CustomOrderBadge value={order.paymentStatus} type="payment" />
            <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
            {summary?.hasUnread ? (
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                💬 {unreadCount > 0 ? `${unreadCount} unread` : 'New messages'}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                {formatCustomOrderCode(order.id)}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{order.sourceTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Built with {order.brand.name}. Open the workspace to review measurements, payment state, delivery commitments, and support actions without leaving the custom-order area.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-black/10 bg-white/90 px-4 py-3 text-right dark:border-white/10 dark:bg-slate-950/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Locked total</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-black/10 bg-white/90 px-3 py-3 dark:border-white/10 dark:bg-slate-950/55">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Brand</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{order.brand.name}</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/90 px-3 py-3 dark:border-white/10 dark:bg-slate-950/55">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Placed</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(order.createdAt)}</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/90 px-3 py-3 dark:border-white/10 dark:bg-slate-950/55">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Delivery target</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(order.promisedDeliveryAt)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getRelativeDeadlineText(order.promisedDeliveryAt)}</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/90 px-3 py-3 dark:border-white/10 dark:bg-slate-950/55">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Measurements</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{order.measurementCount ?? 0} points</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:min-w-[220px]">
          <button
            type="button"
            onClick={onOpenOrder}
            className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Open workspace
          </button>
          <button
            type="button"
            onClick={onOpenChat}
            className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white"
          >
            Open conversation
          </button>
        </div>
      </div>
    </article>
  );
};

const CustomOrdersIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [summaryByOrderId, setSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await customOrdersBuyerApi.list({
          limit: 25,
          q: deferredSearchQuery || undefined,
          status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined,
        });
        if (!active) return;
        setOrders(response.items);

        const orderIds = response.items.map((order) => order.id);
        if (orderIds.length === 0) {
          setSummaryByOrderId({});
          return;
        }

        const bulkSummaries = await messagingApi.getBulkCustomOrderSummaries(orderIds, true);
        if (!active) return;
        setSummaryByOrderId(
          bulkSummaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((acc, item) => {
            acc[item.contextId] = item.summary;
            return acc;
          }, {}),
        );
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
  }, [deferredSearchQuery, statusFilter]);

  const totals = useMemo(
    () => ({
      total: orders.length,
      active: orders.filter((entry) =>
        ['PENDING_BRAND_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(entry.status),
      ).length,
      awaitingPayment: orders.filter((entry) => entry.paymentStatus !== 'PAID').length,
      disputed: orders.filter((entry) => entry.status === 'DISPUTED' || entry.status === 'DELIVERY_ISSUE_REPORTED').length,
    }),
    [orders],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => navigate('/profile')} className="font-semibold text-slate-800 dark:text-white">
          Profile
        </button>
        <span>/</span>
        <button type="button" onClick={() => navigate('/orders')} className="font-semibold text-slate-800 dark:text-white">
          Orders
        </button>
        <span>/</span>
        <span className="font-medium">Custom orders</span>
      </div>

      <section className="mt-5 rounded-[2rem] border border-black/10 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">Buyer Custom Orders</div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Manage every custom order from its own workspace.</h1>
            <p className="mt-3 text-sm text-slate-200 sm:text-base">
              This page is now the dedicated custom-order tab for buyers. Review progress, payment, deadlines, and conversations here instead of digging through the standard-order flow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
            >
              Open messages
            </button>
            <button
              type="button"
              onClick={() => navigate('/custom-orders/new')}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Start new custom order
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <CustomOrderMetricCard label="Orders in view" value={totals.total} helper="Current filtered queue" />
          <CustomOrderMetricCard label="Active" value={totals.active} helper="Live production or delivery" />
          <CustomOrderMetricCard label="Awaiting payment" value={totals.awaitingPayment} helper="Not yet cleared for brand work" />
          <CustomOrderMetricCard label="Needs attention" value={totals.disputed} helper="Disputes or delivery issues" />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Dedicated custom-order queue</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Search the queue, review richer summaries, and jump into the correct workspace directly.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_280px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title, order code, or brand"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950"
          />
          <UniversalSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
          />
        </div>

        <div className="mt-5 space-y-4">
          {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading your custom-order queue...</div> : null}
          {!loading && orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No custom orders match the current search and filter state.
            </div>
          ) : null}

          {orders.map((order) => (
            <BuyerCustomOrderCard
              key={order.id}
              order={order}
              summary={summaryByOrderId[order.id]}
              onOpenOrder={() => navigate(`/custom-orders/${order.id}`)}
              onOpenChat={() => navigate(`/messages?customOrderId=${encodeURIComponent(order.id)}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default CustomOrdersIndexPage;
