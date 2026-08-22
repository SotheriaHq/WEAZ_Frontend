import React, { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoreStatus } from '@/api/StoreApi';
import { useCachedQuery, cachePolicies } from '@/cache';
import { queryKeys } from '@/query/queryKeys';
import {
  customOrdersBrandApi,
  type CustomOrderListItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { messagingApi, type ThreadSummaryResponse } from '@/api/MessagingApi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  CustomOrderBadge,
  formatDateTime,
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
  { value: 'PENDING_BRAND_ACCEPTANCE', label: 'Pre-production hold' },
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

  // Read-only admin notice (reminder/dispute) the brand hasn't opened yet.
  const hasAdminNotice = Boolean(order.hasUnreadAdminNotice);

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] ${cardTone(order.status)} ${
        hasAdminNotice ? 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-transparent' : ''
      }`}
    >
      <div className="grid items-center gap-0 lg:grid-cols-[64px_minmax(0,1fr)_170px_140px_130px]">
        {/* Mobile + Desktop Thumbnail */}
        <div className="flex items-center gap-3 p-3 lg:p-0 overflow-hidden border-b border-black/[0.04] dark:border-white/[0.04] lg:border-b-0">
          <div className="overflow-hidden rounded-xl shrink-0">
            {order.sourcePrimaryMediaUrl ? (
              <ImageWithFallback
                src={order.sourcePrimaryMediaUrl}
                alt={order.sourceTitle}
                fallbackName={order.sourceTitle}
                fit="cover"
                rounded="xl"
                containerClassName="h-[48px] w-[48px] lg:h-[64px] lg:w-[64px] overflow-hidden"
                className="h-[48px] w-[48px] lg:h-[64px] lg:w-[64px]"
                maxHeightClassName="max-h-[64px]"
              />
            ) : (
              <div className="flex h-[48px] w-[48px] lg:h-[64px] lg:w-[64px] items-center justify-center bg-slate-950 text-xl lg:text-2xl text-white">
                <span aria-hidden="true">🧵</span>
              </div>
            )}
          </div>
          {/* Mobile Identity Info */}
          <div className="min-w-0 flex-1 lg:hidden">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {formatCustomOrderCode(order.id)}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{order.sourceTitle}</div>
            <div className="text-[11px] text-slate-500 truncate">
              {order.buyer?.name || 'Buyer'} • {[order.delivery?.city, order.delivery?.state].filter(Boolean).join(', ') || 'No address'}
            </div>
          </div>
        </div>

        {/* Desktop Order Identity */}
        <div className="hidden lg:block min-w-0 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {formatCustomOrderCode(order.id)}
            </span>
            {summary?.hasUnread ? (
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                💬 {unreadCount > 0 ? `${unreadCount}` : '●'}
              </span>
            ) : null}
            {hasAdminNotice ? (
              <span
                className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300"
                title="An admin left a reminder or dispute notice — open the order to read it"
              >
                📣 Admin notice
              </span>
            ) : null}
          </div>
          <div className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">{order.sourceTitle}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CustomOrderBadge value={order.status} />
            <CustomOrderBadge value={order.paymentStatus} type="payment" />
            <CustomOrderBadge value={order.currentProgressStage ?? 'ORDER_PLACED'} type="stage" />
          </div>
        </div>

        {/* Desktop Buyer + delivery */}
        <div className="hidden border-l border-black/[0.06] px-4 py-3 dark:border-white/[0.06] lg:block">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Buyer</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{order.buyer?.name || '—'}</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {[order.delivery?.city, order.delivery?.state].filter(Boolean).join(', ') || order.delivery?.country || 'No address'}
          </div>
        </div>

        {/* Desktop Total + placed */}
        <div className="hidden border-l border-black/[0.06] px-4 py-3 dark:border-white/[0.06] lg:block">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Total</div>
          <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
            {formatCurrency(order.buyerPriceSummary.grandTotal, order.buyerPriceSummary.currency)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(order.createdAt)}</div>
        </div>

        {/* Status badges row on Mobile */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 lg:hidden">
          <div className="flex flex-wrap items-center gap-1">
            <CustomOrderBadge value={order.status} />
            <CustomOrderBadge value={order.paymentStatus} type="payment" />
          </div>
          {summary?.hasUnread ? (
            <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              💬 {unreadCount > 0 ? `${unreadCount}` : '●'}
            </span>
          ) : null}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 border-t lg:border-t-0 border-l-0 lg:border-l border-black/[0.06] p-2.5 lg:px-4 lg:py-3 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onOpenOrder}
            className="flex-1 rounded-full bg-slate-950 px-3 py-1.5 lg:py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800"
          >
            Open Order
          </button>
          <button
            type="button"
            onClick={onOpenMessages}
            aria-label="Open messages"
            className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 lg:py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 hover:bg-slate-100"
          >
            💬
          </button>
        </div>
      </div>
    </article>
  );
};

type CustomOrdersData = {
  brandId: string | null;
  orders: CustomOrderListItem[];
  summaryByOrderId: Record<string, ThreadSummaryResponse | null>;
};

const CustomOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [chatTarget, setChatTarget] = useState<Pick<CustomOrderListItem, 'id'> & { customerName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Cache-first: a previously loaded queue paints instantly and revalidates in
  // the background; each (status, search) combination is cached under its own key.
  const customOrdersQuery = useCachedQuery<CustomOrdersData>({
    key: queryKeys.customOrders.brandQueue({ status: statusFilter, search: deferredSearchQuery }),
    fetcher: async () => {
      const status = await getStoreStatus();
      const response = await customOrdersBrandApi.list(status.brandId, {
        status: statusFilter ? (statusFilter as CustomOrderStatus) : undefined,
        q: deferredSearchQuery || undefined,
        limit: 30,
      });
      const visibleOrders = collapseVisibleQueueOrders(response.items);
      const orderIds = visibleOrders.map((entry) => entry.id);
      let summaryByOrderId: Record<string, ThreadSummaryResponse | null> = {};
      if (orderIds.length > 0) {
        const summaries = await messagingApi.getBulkCustomOrderSummariesForBrand(
          status.brandId,
          orderIds,
          true,
        );
        summaryByOrderId = summaries.items.reduce<Record<string, ThreadSummaryResponse | null>>(
          (accumulator, item) => {
            accumulator[item.contextId] = item.summary;
            return accumulator;
          },
          {},
        );
      }
      return { brandId: status.brandId, orders: visibleOrders, summaryByOrderId };
    },
    policy: cachePolicies.defaultQuery,
  });
  const brandId = customOrdersQuery.data?.brandId ?? null;
  const orders = customOrdersQuery.data?.orders ?? [];
  const summaryByOrderId = customOrdersQuery.data?.summaryByOrderId ?? {};
  const loading = customOrdersQuery.isLoading;

  const metrics = useMemo(
    () => ({
      total: orders.length,
      awaitingMoney: orders.filter((entry) => entry.paymentStatus !== 'PAID').length,
      active: orders.filter((entry) =>
        ['PENDING_BRAND_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'IN_TRANSIT'].includes(entry.status),
      ).length,
      issues: orders.filter(
        (entry) =>
          ['DISPUTED', 'DELIVERY_ISSUE_REPORTED'].includes(entry.status) ||
          entry.hasUnreadAdminNotice,
      ).length,
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

      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-3 py-4 text-white shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Studio</div>
            <h1 className="mt-0.5 text-xl font-bold">Custom orders</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/studio/messages')}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Open studio messages
            </button>
            <button
              type="button"
              onClick={() => navigate('/studio?tab=orders')}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950"
            >
              Standard orders
            </button>
          </div>
        </div>

        {/*
          Four counters, four columns - the same shape the standard-orders tab
          uses, because they are the same kind of thing.

          `flex-wrap` gave these a different ragged layout at every width: three
          on one line and a lonely fourth below it, or two and two, depending on
          how long the numbers happened to be. A grid makes the row stable and
          makes the two tabs agree with each other.

          Number over label rather than beside it, so the label has the full
          column width and does not have to compete with the figure for it.
        */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="min-w-0 rounded-xl bg-white/10 px-2 py-2 sm:px-3.5">
            <div className="text-base font-bold leading-tight sm:text-lg">{metrics.total}</div>
            <div className="text-[10px] leading-tight text-slate-300 sm:text-xs">in view</div>
          </div>
          <div className="min-w-0 rounded-xl bg-amber-500/20 px-2 py-2 sm:px-3.5">
            <div className="text-base font-bold leading-tight text-amber-200 sm:text-lg">{metrics.awaitingMoney}</div>
            <div className="text-[10px] leading-tight text-amber-300/80 sm:text-xs">awaiting payment</div>
          </div>
          <div className="min-w-0 rounded-xl bg-emerald-500/20 px-2 py-2 sm:px-3.5">
            <div className="text-base font-bold leading-tight text-emerald-200 sm:text-lg">{metrics.active}</div>
            <div className="text-[10px] leading-tight text-emerald-300/80 sm:text-xs">active pipeline</div>
          </div>
          <div className="min-w-0 rounded-xl bg-rose-500/20 px-2 py-2 sm:px-3.5">
            <div className="text-base font-bold leading-tight text-rose-200 sm:text-lg">{metrics.issues}</div>
            <div className="text-[10px] leading-tight text-rose-300/80 sm:text-xs">needs attention</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/85 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] sm:rounded-[2rem] sm:p-6">
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

        <div className="mt-5 space-y-2">
          {loading && orders.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`custom-order-skeleton-${index}`}
                  className="h-16 animate-pulse rounded-2xl border border-black/10 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.06]"
                />
              ))}
            </div>
          ) : null}
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
