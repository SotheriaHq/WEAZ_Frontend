import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import {
  customOrdersBrandApi,
  type CustomOrderListItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  CustomOrderBadge,
  CustomOrderMetricCard,
  formatDateTime,
  getRelativeDeadlineText,
} from '@/components/custom-orders/CustomOrderUi';
import OrderChatDrawer from '@/components/messaging/OrderChatDrawer';
import {
  formatCustomOrderCode,
} from '@/components/custom-orders/customOrderFormatting';
import ImageWithFallback from '@/components/ImageWithFallback';

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'PENDING_BRAND_ACCEPTANCE', label: 'Pending brand acceptance' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for dispatch' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED_PENDING_BUYER_CONFIRMATION', label: 'Awaiting buyer confirmation' },
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

const collapseVisibleQueueOrders = (items: CustomOrderListItem[]) => {
  const preAcceptanceStatuses = new Set<CustomOrderStatus>([
    'DRAFT',
    'PENDING_PAYMENT',
    'PENDING_BRAND_ACCEPTANCE',
  ]);
  const grouped = new Map<string, CustomOrderListItem>();

  for (const item of items) {
    const dedupeKey = preAcceptanceStatuses.has(item.status)
      ? [
          item.sourceType,
          item.sourceId,
          item.sourceTitle,
          item.buyer?.email ?? '',
          item.buyer?.phone ?? '',
          item.buyerPriceSummary.grandTotal,
          item.delivery?.city ?? '',
          item.delivery?.state ?? '',
          item.measurementCount ?? 0,
        ].join('::')
      : item.id;

    const existing = grouped.get(dedupeKey);
    if (!existing) {
      grouped.set(dedupeKey, item);
      continue;
    }

    const existingScore =
      (existing.sourcePrimaryMediaUrl ? 5 : 0) +
      (existing.updatedAt ? new Date(existing.updatedAt).getTime() : new Date(existing.createdAt).getTime());
    const incomingScore =
      (item.sourcePrimaryMediaUrl ? 5 : 0) +
      (item.updatedAt ? new Date(item.updatedAt).getTime() : new Date(item.createdAt).getTime());

    if (incomingScore >= existingScore) {
      grouped.set(dedupeKey, item);
    }
  }

  return Array.from(grouped.values());
};

const StudioCustomOrderCard: React.FC<{
  order: CustomOrderListItem;
  summary: ThreadSummaryResponse | null | undefined;
  onOpenOrder: () => void;
  onOpenMessages: () => void;
}> = ({ order, summary, onOpenOrder, onOpenMessages }) => {
  const unreadCount = Number(summary?.unreadCount ?? 0);

  return (
    <article className={`overflow-hidden rounded-[1.6rem] p-3 transition hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${cardTone(order.status)}`}>
      <div className="grid gap-3 lg:grid-cols-[104px_minmax(0,1fr)_180px] lg:items-center">
        <div className="overflow-hidden rounded-[1.35rem] border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.06]">
          {order.sourcePrimaryMediaUrl ? (
            <ImageWithFallback
              src={order.sourcePrimaryMediaUrl}
              alt={order.sourceTitle}
              fallbackName={order.sourceTitle}
              fit="cover"
              rounded="none"
              containerClassName="h-[104px] w-full overflow-hidden"
              className="h-[104px] w-full"
              maxHeightClassName="max-h-[104px]"
            />
          ) : (
            <div className="flex h-[104px] items-center justify-center bg-slate-950 text-4xl text-white">
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
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                💬 {unreadCount > 0 ? `${unreadCount} unread` : 'New messages'}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-start">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                {formatCustomOrderCode(order.id)}
              </div>
              <h2 className="mt-1 line-clamp-1 text-lg font-bold text-slate-900 dark:text-white">{order.sourceTitle}</h2>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Review buyer, delivery promise, and measurement coverage before opening the full workspace.
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-black/10 bg-slate-50/90 px-3 py-2 lg:text-right dark:border-white/10 dark:bg-slate-950/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Buyer total</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
              </div>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-950/45">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Buyer</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{order.buyer?.name || 'Customer not named'}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.buyer?.email || order.buyer?.phone || 'No contact snapshot'}</div>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-950/45">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Placed</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(order.createdAt)}</div>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-950/45">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Delivery promise</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(order.promisedDeliveryAt)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getRelativeDeadlineText(order.promisedDeliveryAt)}</div>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-950/45">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Delivery snapshot</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {[order.delivery?.city, order.delivery?.state].filter(Boolean).join(', ') || order.delivery?.country || 'No address snapshot'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.measurementCount ?? 0} measurements attached</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[180px] lg:self-center">
          <button
            type="button"
            onClick={onOpenOrder}
            className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Open workspace
          </button>
          <button
            type="button"
            onClick={onOpenMessages}
            className="rounded-full border border-slate-300 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            Open messages
          </button>
        </div>
      </div>
    </article>
  );
};

const CustomOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomOrderListItem[]>([]);
  const [chatTarget, setChatTarget] = useState<Pick<CustomOrderListItem, 'id'> & { customerName: string } | null>(null);
  const [summaryByOrderId, setSummaryByOrderId] = useState<Record<string, ThreadSummaryResponse | null>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const refreshSequenceRef = useRef(0);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const sequence = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = sequence;
      setLoading(true);

      try {
        const status = await getStoreStatus();
        if (!active || refreshSequenceRef.current !== sequence) return;

        setBrandId(status.brandId);
        const response = await customOrdersBrandApi.list(status.brandId, {
          status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined,
          q: deferredSearchQuery || undefined,
          limit: 30,
        });
        if (!active || refreshSequenceRef.current !== sequence) return;

        const visibleOrders = collapseVisibleQueueOrders(response.items);
        setOrders(visibleOrders);
        const orderIds = visibleOrders.map((entry) => entry.id);
        if (orderIds.length === 0) {
          setSummaryByOrderId({});
        } else {
          const summaries = await messagingApi.getBulkCustomOrderSummariesForBrand(
            status.brandId,
            orderIds,
            true,
          );
          if (!active || refreshSequenceRef.current !== sequence) return;
          setSummaryByOrderId(
            summaries.items.reduce<Record<string, ThreadSummaryResponse | null>>((accumulator, item) => {
              accumulator[item.contextId] = item.summary;
              return accumulator;
            }, {}),
          );
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load custom orders');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [deferredSearchQuery, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: orders.length,
      awaitingMoney: orders.filter((entry) => entry.paymentStatus !== 'PAID').length,
      active: orders.filter((entry) =>
        ['PENDING_BRAND_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(entry.status),
      ).length,
      issues: orders.filter((entry) => ['DISPUTED', 'DELIVERY_ISSUE_REPORTED'].includes(entry.status)).length,
    }),
    [orders],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => navigate('/studio')} className="font-semibold text-slate-800 dark:text-white">
          Studio
        </button>
        <span>/</span>
        <button type="button" onClick={() => navigate('/studio?tab=orders')} className="font-semibold text-slate-800 dark:text-white">
          Orders
        </button>
        <span>/</span>
        <span className="font-medium">Custom orders</span>
      </div>

      <section className="rounded-[2rem] border border-black/10 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">Studio Custom Orders</div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Handle the queue here. Manage each order on its own page.</h1>
            <p className="mt-3 text-sm text-slate-200 sm:text-base">
              This view is now the dedicated studio custom-order tab. Cards show the important buyer, payment, and deadline context before you open the full management workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/studio/messages')}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
            >
              Open studio messages
            </button>
            <button
              type="button"
              onClick={() => navigate('/studio?tab=orders')}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Standard orders
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <CustomOrderMetricCard label="Orders in view" value={metrics.total} helper="Current filtered queue" />
          <CustomOrderMetricCard label="Awaiting payment" value={metrics.awaitingMoney} helper="Not ready for production" />
          <CustomOrderMetricCard label="Active pipeline" value={metrics.active} helper="Live production or delivery" />
          <CustomOrderMetricCard label="Needs attention" value={metrics.issues} helper="Disputes or delivery issues" />
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Studio queue</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Search the queue, inspect richer order summaries, and move straight into the dedicated workspace.
            </p>
          </div>
          {brandId ? (
            <div className="rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              Brand queue ready
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_280px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by order title or order code"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950"
          />
          <UniversalSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
          />
        </div>

        <div className="mt-5 space-y-4">
          {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading custom-order queue...</div> : null}
          {!loading && orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No custom orders match the current search and filter state.
            </div>
          ) : null}

          {orders.map((order) => (
            <StudioCustomOrderCard
              key={order.id}
              order={order}
              summary={summaryByOrderId[order.id]}
              onOpenOrder={() => navigate(`/studio/custom-orders/${order.id}`)}
              onOpenMessages={() =>
                setChatTarget({
                  id: order.id,
                  customerName: order.buyer?.name || order.sourceTitle || 'Buyer',
                })
              }
            />
          ))}
        </div>
      </section>

      <OrderChatDrawer
        open={Boolean(chatTarget)}
        onClose={() => setChatTarget(null)}
        orderId={chatTarget?.id ?? ''}
        contextType="CUSTOM_ORDER"
        brandId={brandId}
        actorSurface="BRAND"
        customerName={chatTarget?.customerName || 'Buyer'}
      />
    </div>
  );
};

export default CustomOrdersPage;
