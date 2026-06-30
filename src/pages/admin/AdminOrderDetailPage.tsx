import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminOrdersApi } from '@/api/AdminApi';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import ImageWithFallback from '@/components/ImageWithFallback';
import VLoader from '@/components/loaders/VLoader';
import { unwrapApiResponse } from '@/types/auth';
import type { AdminStandardOrderDetail } from '@/types/admin';
import { formatMeasurementLabel } from '@/utils/measurementLabels';

const shell =
  'rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]';

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

const asNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isLikelyFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

const statusTone = (value?: string | null) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'DELIVERED') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (normalized === 'SHIPPED') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';
  }
  if (normalized === 'PROCESSING') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (normalized === 'CANCELLED' || normalized === 'RETURNED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300';
};

const paymentTone = (value?: string | null) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'PAID') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (normalized === 'PROCESSING' || normalized === 'REQUIRES_ACTION') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'EXPIRED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300';
};

const extractMeasurements = (snapshot: Record<string, unknown> | null | undefined) => {
  if (!snapshot || typeof snapshot !== 'object') return [] as Array<{
    key: string;
    label: string;
    value: string;
  }>;

  const measurements =
    snapshot.measurements &&
    typeof snapshot.measurements === 'object' &&
    !Array.isArray(snapshot.measurements)
      ? (snapshot.measurements as Record<string, any>)
      : null;

  if (!measurements) return [];

  return Object.entries(measurements)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      if (typeof value === 'object' && value && 'value' in value) {
        const unit = typeof value.unit === 'string' ? ` ${value.unit}` : '';
        return {
          key,
          label: formatMeasurementLabel(key),
          value: `${String(value.value)}${unit}`,
        };
      }

      return {
        key,
        label: formatMeasurementLabel(key),
        value: String(value),
      };
    });
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  note?: string;
}> = ({ label, value, note }) => (
  <div className="rounded-2xl border border-black/10 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {label}
    </div>
    <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
    {note ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</div> : null}
  </div>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-dashed border-black/10 py-2 last:border-b-0 dark:border-white/10">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className="max-w-[60%] text-right text-sm font-medium text-slate-900 dark:text-white">
      {value}
    </span>
  </div>
);

const LoaderBlock = () => (
  <div className="py-16">
    <VLoader size={40} phase="loading" showLabel={false} />
  </div>
);

const AdminOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminStandardOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const response = await adminOrdersApi.getById(orderId);
      setOrder(unwrapApiResponse<AdminStandardOrderDetail>(response.data as any));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load standard-order detail');
      navigate('/admin/finance', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate, orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const lineItems = useMemo(() => (Array.isArray(order?.orderItems) ? order.orderItems : []), [
    order?.orderItems,
  ]);
  const financeBreakdown = order?.financeBreakdown ?? null;
  const buyerReceipt = order?.buyerReceipt ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminBreadcrumb
          segments={[
            { label: 'Finance', path: '/admin/finance' },
            { label: 'Standard order' },
          ]}
        />
        <LoaderBlock />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <AdminBreadcrumb
          segments={[
            { label: 'Finance', path: '/admin/finance' },
            { label: 'Standard order' },
          ]}
        />
        <div className={`${shell} text-sm text-slate-500 dark:text-slate-400`}>
          Standard order not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segments={[
          { label: 'Finance', path: '/admin/finance' },
          { label: 'Standard order' },
          { label: `#${order.id.slice(0, 8).toUpperCase()}` },
        ]}
      />

      <section className={shell}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Finance drill-through
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Standard order</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Read-only admin view of fulfillment, buyer contact, and finance state for this order.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}
              >
                {order.status}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentTone(order.paymentStatus)}`}
              >
                {order.paymentStatus}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/finance')}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Back to finance
            </button>
            <button
              type="button"
              onClick={() => void loadOrder()}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Order total"
            value={formatCurrency(asNumber(order.totalAmount), order.currency || 'NGN')}
            note={`Created ${formatDateTime(order.createdAt)}`}
          />
          <MetricCard
            label="Brand"
            value={order.brand?.name || 'Brand'}
            note={order.brand?.contactEmail || 'No brand support email'}
          />
          <MetricCard
            label="Payment reference"
            value={order.paymentReference || 'Not recorded'}
            note={order.paymentMethod || 'Payment method unavailable'}
          />
          <MetricCard
            label="Items"
            value={String(lineItems.length)}
            note={order.updatedAt ? `Updated ${formatDateTime(order.updatedAt)}` : 'Recently updated'}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={`${shell} overflow-hidden`}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Line items</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Checkout snapshot saved with the order for production and support review.
            </p>
          </div>

          <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
            {lineItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No line items were saved on this order.
              </div>
            ) : (
              lineItems.map((item) => {
                const name = item.nameAtPurchase || 'Order item';
                const thumbnail = item.thumbnailAtPurchase || null;
                const fileId = isLikelyFileId(thumbnail) ? thumbnail : undefined;
                const src = fileId ? undefined : thumbnail || undefined;
                const measurements = extractMeasurements(
                  item.sizeFitSnapshot as Record<string, unknown> | null | undefined,
                );
                const requiredKeys = Array.isArray(item.requiredMeasurementKeys)
                  ? item.requiredMeasurementKeys
                  : [];

                return (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.04]">
                          {thumbnail ? (
                            <ImageWithFallback
                              src={src}
                              fileId={fileId}
                              alt={name}
                              fit="cover"
                              rounded="none"
                              className="h-full w-full object-cover"
                              containerClassName="h-full w-full"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">
                              Item
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">
                              {name}
                            </div>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Qty {item.quantity} ·{' '}
                              {formatCurrency(asNumber(item.unitPrice), order.currency || 'NGN')} each
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {item.selectedSize ? (
                              <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                                Size {item.selectedSize}
                              </span>
                            ) : null}
                            {item.selectedColor ? (
                              <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                                Color {item.selectedColor}
                              </span>
                            ) : null}
                            {requiredKeys.length > 0 ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                {requiredKeys.length} required measurements
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Line total
                        </div>
                        <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {formatCurrency(asNumber(item.totalPrice), order.currency || 'NGN')}
                        </div>
                      </div>
                    </div>

                    {measurements.length > 0 || requiredKeys.length > 0 ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Measurements captured
                          </div>
                          {measurements.length === 0 ? (
                            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                              No measurement values were stored for this item.
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {measurements.map((measurement) => (
                                <div
                                  key={measurement.key}
                                  className="rounded-2xl border border-black/10 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]"
                                >
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    {measurement.label}
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                                    {measurement.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Required points
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {requiredKeys.length === 0 ? (
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                No required points were recorded.
                              </span>
                            ) : (
                              requiredKeys.map((key) => (
                                <span
                                  key={key}
                                  className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                                >
                                  {formatMeasurementLabel(key)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className={shell}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Customer and shipping
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer</div>
                <div className="mt-3 space-y-2">
                  <DetailRow label="Name" value={order.customerName || 'Not recorded'} />
                  <DetailRow label="Email" value={order.customerEmail || 'Not recorded'} />
                  <DetailRow label="Phone" value={order.customerPhone || 'Not recorded'} />
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Shipping</div>
                <div className="mt-3 space-y-2">
                  <DetailRow
                    label="Address"
                    value={order.formattedShippingAddress || 'Not recorded'}
                  />
                  <DetailRow
                    label="Brand support"
                    value={
                      order.brand?.contactEmail ||
                      order.brand?.owner?.phoneNumber ||
                      'Not recorded'
                    }
                  />
                  <DetailRow
                    label="Brand address"
                    value={order.brand?.owner?.address || 'Not recorded'}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={`${shell} overflow-hidden`}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Finance breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                WIEZ ledger and escrow state for this standard order.
              </p>
            </div>

            <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="space-y-1">
                  <DetailRow
                    label="Subtotal"
                    value={formatCurrency(
                      financeBreakdown?.itemSubtotal ?? asNumber(order.totalAmount),
                      financeBreakdown?.currency || order.currency || 'NGN',
                    )}
                  />
                  <DetailRow
                    label="Shipping"
                    value={formatCurrency(
                      financeBreakdown?.shippingAmount ?? asNumber(order.shippingCost),
                      financeBreakdown?.currency || order.currency || 'NGN',
                    )}
                  />
                  <DetailRow
                    label="Discount"
                    value={formatCurrency(
                      financeBreakdown?.discountAmount ?? asNumber(order.discountAmount),
                      financeBreakdown?.currency || order.currency || 'NGN',
                    )}
                  />
                  <DetailRow
                    label="Gross total"
                    value={formatCurrency(
                      financeBreakdown?.grossAmount ?? asNumber(order.totalAmount),
                      financeBreakdown?.currency || order.currency || 'NGN',
                    )}
                  />
                  <DetailRow
                    label="Commission"
                    value={
                      financeBreakdown?.commissionAmount != null
                        ? formatCurrency(
                            financeBreakdown.commissionAmount,
                            financeBreakdown.currency || order.currency || 'NGN',
                          )
                        : 'Not posted'
                    }
                  />
                  <DetailRow
                    label="Brand net"
                    value={
                      financeBreakdown?.netBrandAmount != null
                        ? formatCurrency(
                            financeBreakdown.netBrandAmount,
                            financeBreakdown.currency || order.currency || 'NGN',
                          )
                        : 'Not posted'
                    }
                  />
                  <DetailRow
                    label="Escrow status"
                    value={financeBreakdown?.escrowStatus || 'Not created'}
                  />
                  <DetailRow
                    label="Paid at"
                    value={formatDateTime(financeBreakdown?.paidAt || order.paidAt)}
                  />
                </div>
              </div>

              {Array.isArray(financeBreakdown?.releaseSchedule) &&
              financeBreakdown.releaseSchedule.length > 0 ? (
                <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Release schedule
                  </div>
                  <div className="mt-3 space-y-3">
                    {financeBreakdown.releaseSchedule.map((stage) => (
                      <div
                        key={stage.stage}
                        className="rounded-2xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              {stage.stage.replaceAll('_', ' ')}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Eligible {formatDateTime(stage.eligibleAt || null)}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            <div>
                              Gross{' '}
                              {formatCurrency(
                                asNumber(stage.grossAmount),
                                financeBreakdown.currency || order.currency || 'NGN',
                              )}
                            </div>
                            <div>
                              Net{' '}
                              {formatCurrency(
                                asNumber(stage.netAmount),
                                financeBreakdown.currency || order.currency || 'NGN',
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Released {formatDateTime(stage.releasedAt || null)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {buyerReceipt ? (
                <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Buyer receipt
                  </div>
                  <div className="mt-3 space-y-1">
                    <DetailRow label="Document" value={buyerReceipt.documentNumber} />
                    <DetailRow label="Issued" value={formatDateTime(buyerReceipt.issuedAt)} />
                    <DetailRow
                      label="Settlement amount"
                      value={
                        buyerReceipt.settlementAmount != null
                          ? formatCurrency(
                              buyerReceipt.settlementAmount,
                              buyerReceipt.settlementCurrency ||
                                buyerReceipt.currency ||
                                order.currency ||
                                'NGN',
                            )
                          : 'Not recorded'
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ledger transactions
                </div>
                <div className="mt-3 space-y-3">
                  {Array.isArray(financeBreakdown?.ledgerTransactions) &&
                  financeBreakdown.ledgerTransactions.length > 0 ? (
                    financeBreakdown.ledgerTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              {transaction.description || transaction.type}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {transaction.type} · {formatDateTime(transaction.createdAt)}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(
                              asNumber(transaction.totalAmount),
                              transaction.currency || order.currency || 'NGN',
                            )}
                          </div>
                        </div>

                        {Array.isArray(transaction.entries) && transaction.entries.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {transaction.entries.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                              >
                                <div className="text-slate-500 dark:text-slate-400">
                                  {entry.accountCode || 'Account'} · {entry.direction}
                                </div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {formatCurrency(
                                    asNumber(entry.amount),
                                    transaction.currency || order.currency || 'NGN',
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No ledger postings have been projected for this order yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
