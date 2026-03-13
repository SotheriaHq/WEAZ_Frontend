import React, { useCallback, useEffect, useRef, useState } from 'react';
import { brandApi } from '@/api/BrandApi';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import VLoader from '@/components/loaders/VLoader';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getSizingModeLabel } from '@/types/sizing';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  brandId: string;
  onStatusUpdate: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
};

const prettifyMeasurementKey = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isLikelyFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

const getStatusTone = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'DELIVERED':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20';
    case 'PENDING':
      return 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/20';
    case 'PROCESSING':
      return 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border border-blue-500/20';
    case 'SHIPPED':
      return 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20';
    case 'CANCELLED':
      return 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/20';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20';
  }
};

const getPaymentTone = (status?: string | null) =>
  String(status || '').toUpperCase() === 'PAID'
    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
    : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20';

const extractMeasurements = (snapshot: Record<string, any> | null | undefined) => {
  if (!snapshot || typeof snapshot !== 'object') return [] as Array<{ key: string; label: string; value: string }>;

  const measurements =
    snapshot.measurements && typeof snapshot.measurements === 'object' && !Array.isArray(snapshot.measurements)
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
          label: prettifyMeasurementKey(key),
          value: `${value.value}${unit}`,
        };
      }

      return {
        key,
        label: prettifyMeasurementKey(key),
        value: String(value),
      };
    });
};

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  brandId,
  onStatusUpdate
}) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  const fetchOrderDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await brandApi.getOrderDetail(brandId, orderId);
      setOrder(data);
    } catch (error) {
      console.error('Failed to fetch order details', error);
    } finally {
      setLoading(false);
    }
  }, [brandId, orderId]);

  useEffect(() => {
    if (isOpen && orderId && brandId) {
      void fetchOrderDetails();
    } else {
      setOrder(null);
    }
  }, [isOpen, orderId, brandId, fetchOrderDetails]);

  // Scroll Locking
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(newStatus);
    try {
      await brandApi.updateOrderStatus(brandId, orderId, newStatus);
      await fetchOrderDetails();
      onStatusUpdate();
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (!isOpen) return null;

  const lineItems = Array.isArray(order?.orderItems) && order.orderItems.length > 0
    ? order.orderItems
    : Array.isArray(order?.items)
      ? order.items
      : [];

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Order details">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div ref={dialogRef} tabIndex={-1} className="relative z-layer-modal flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 shadow-2xl outline-none dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(16,16,16,0.98),rgba(10,10,10,0.96))]">
          {updatingStatus ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/35 backdrop-blur-sm">
              <VLoader size={64} progress={72} phase="loading" />
              <p className="text-sm font-semibold text-white">Updating order to {updatingStatus.toLowerCase()}…</p>
            </div>
          ) : null}

          <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(249,115,22,0.16),rgba(249,115,22,0.04),transparent)] px-6 py-5 dark:border-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">Studio order review</div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Order Details</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">#{orderId.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(order?.status)}`}>
                    {order?.status || 'Loading'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getPaymentTone(order?.paymentStatus)}`}>
                    {order?.paymentStatus || 'Pending'}
                  </span>
                </div>
                <button onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-lg text-slate-500 transition hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white" aria-label="Close">
                  ×
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-6 overscroll-contain md:p-7">
            {loading ? (
              <div className="flex justify-center py-16">
                <VLoader size={64} progress={60} phase="loading" />
              </div>
            ) : order ? (
              <>
                <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Order workflow</p>
                        <h3 className="mt-1 text-lg font-bold">Brand action controls</h3>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-slate-500">
                        <p>Placed {new Date(order.createdAt).toLocaleString()}</p>
                        {order.updatedAt ? <p>Updated {new Date(order.updatedAt).toLocaleString()}</p> : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {order.status === 'PENDING' ? (
                        <button
                          onClick={() => handleStatusUpdate('PROCESSING')}
                          disabled={Boolean(updatingStatus)}
                          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          🧵 Process order
                        </button>
                      ) : null}
                      {order.status === 'PROCESSING' ? (
                        <button
                          onClick={() => handleStatusUpdate('SHIPPED')}
                          disabled={Boolean(updatingStatus)}
                          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                        >
                          🚚 Mark shipped
                        </button>
                      ) : null}
                      {order.status === 'SHIPPED' ? (
                        <button
                          onClick={() => handleStatusUpdate('DELIVERED')}
                          disabled={Boolean(updatingStatus)}
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          ✅ Mark delivered
                        </button>
                      ) : null}
                      {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' ? (
                        <button
                          onClick={() => handleStatusUpdate('CANCELLED')}
                          disabled={Boolean(updatingStatus)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                        >
                          ✖ Cancel order
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Payment & totals</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                        <span className="font-semibold">{formatCurrency(Number(order.totalAmount) - Number(order.shippingCost || 0), order.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Shipping</span>
                        <span className="font-semibold">{formatCurrency(Number(order.shippingCost || 0), order.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold dark:border-white/10">
                        <span>Total</span>
                        <span>{formatCurrency(Number(order.totalAmount), order.currency)}</span>
                      </div>
                      {order.paymentMethod ? (
                        <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          Payment method: <span className="font-semibold">{order.paymentMethod}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Customer</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-lg font-bold">{order.customerName}</p>
                      <p className="text-slate-600 dark:text-slate-400">📧 {order.customerEmail || (order.contactInfo as any)?.email || 'No email'}</p>
                      <p className="text-slate-600 dark:text-slate-400">📞 {order.customerPhone || (order.contactInfo as any)?.phone || 'No phone'}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Shipping</p>
                    <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                      <p>
                        📍 {order.formattedShippingAddress || (typeof order.shippingAddress === 'object' ? [order.shippingAddress?.street, order.shippingAddress?.apartment, order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.country].filter(Boolean).join(', ') : order.shippingAddress) || 'No shipping address provided'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Order facts</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <p>🧾 {lineItems.length} item{lineItems.length === 1 ? '' : 's'}</p>
                      <p>🆔 {order.id}</p>
                      {order.paymentReference ? <p>🔐 {order.paymentReference}</p> : null}
                    </div>
                  </div>
                </section>

                <OrderMessagesPanel
                  contextType="STANDARD_ORDER"
                  orderId={orderId}
                  title="Brand order conversation"
                  actorSurface="BRAND"
                  brandId={brandId}
                />

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Items</p>
                      <h3 className="mt-1 text-lg font-bold">Production details by line item</h3>
                    </div>
                  </div>

                  {lineItems.length > 0 ? (
                    <div className="space-y-4">
                      {lineItems.map((item: any, idx: number) => {
                        const name = item.nameAtPurchase || item.name || item.productName || 'Product';
                        const thumb = item.thumbnailAtPurchase || item.thumbnail || item.image || null;
                        const unitPrice = Number(item.unitPrice || item.price || 0);
                        const qty = Number(item.quantity || 1);
                        const totalPrice = Number(item.totalPrice || unitPrice * qty || 0);
                        const sizeFitSnapshot = item.sizeFitSnapshot && typeof item.sizeFitSnapshot === 'object'
                          ? (item.sizeFitSnapshot as Record<string, any>)
                          : null;
                        const measurements = extractMeasurements(sizeFitSnapshot);
                        const requiredKeys = Array.isArray(item.requiredMeasurementKeys)
                          ? item.requiredMeasurementKeys
                          : Array.isArray(sizeFitSnapshot?.requiredMeasurementKeys)
                            ? sizeFitSnapshot?.requiredMeasurementKeys
                            : [];
                        const resolvedSize = item.selectedSize || sizeFitSnapshot?.selectedSize || null;
                        const resolvedColor = item.selectedColor || sizeFitSnapshot?.selectedColor || null;
                        const sizingMode = String(item.sizingMode || sizeFitSnapshot?.mode || 'NONE');
                        const fileId = isLikelyFileId(thumb) ? thumb : undefined;
                        const src = fileId ? undefined : thumb || undefined;

                        return (
                          <article key={item.id || idx} className="rounded-[26px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="flex flex-1 gap-4">
                                <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                                  {thumb ? (
                                    <ImageWithFallback
                                      src={src}
                                      fileId={fileId}
                                      alt={name}
                                      fit="cover"
                                      rounded="xl"
                                      className="h-full w-full object-cover"
                                      containerClassName="h-full w-full"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">🧵</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-3">
                                  <div>
                                    <h4 className="text-lg font-bold leading-tight">{name}</h4>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                      Qty {qty} · {formatCurrency(unitPrice, order.currency)} each
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {resolvedSize ? (
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                        Size {resolvedSize}
                                      </span>
                                    ) : null}
                                    {resolvedColor ? (
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                        Color {resolvedColor}
                                      </span>
                                    ) : null}
                                    {sizingMode && sizingMode !== 'NONE' ? (
                                      <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                        {getSizingModeLabel(sizingMode)}
                                      </span>
                                    ) : null}
                                    {requiredKeys.length > 0 ? (
                                      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
                                        {requiredKeys.length} required points
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right dark:border-white/10 dark:bg-white/5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">Line total</p>
                                <p className="mt-1 text-lg font-extrabold">{formatCurrency(totalPrice, order.currency)}</p>
                              </div>
                            </div>

                            {measurements.length > 0 || requiredKeys.length > 0 ? (
                              <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Measurements provided</p>
                                      <p className="text-sm text-slate-500 dark:text-slate-400">Saved with the order at checkout</p>
                                    </div>
                                  </div>

                                  {measurements.length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                      {measurements.map((measurement) => (
                                        <div key={measurement.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">{measurement.label}</p>
                                          <p className="mt-1 text-sm font-bold">{measurement.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No measurement values were stored for this line item.</p>
                                  )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Required points</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {requiredKeys.length > 0 ? (
                                      requiredKeys.map((key: string) => (
                                        <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                          {prettifyMeasurementKey(key)}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-slate-500 dark:text-slate-400">No required measurement points for this item.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500 dark:border-white/10 dark:text-slate-400">
                      No items found for this order.
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="py-16 text-center text-slate-500 dark:text-slate-400">Order not found</div>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default OrderDetailsModal;
