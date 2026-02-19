import React, { useCallback, useEffect, useRef, useState } from 'react';
import { brandApi } from '@/api/BrandApi';
import { X, Package, Truck, CheckCircle, XCircle, MapPin, Phone, Mail } from 'lucide-react';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  brandId: string;
  onStatusUpdate: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  brandId,
  onStatusUpdate
}) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
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
    setUpdating(true);
    try {
      await brandApi.updateOrderStatus(brandId, orderId, newStatus);
      await fetchOrderDetails();
      onStatusUpdate();
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Order details">
        <div className="fixed inset-0 z-layer-overlay bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div ref={dialogRef} tabIndex={-1} className="bg-white dark:bg-gray-900 neu-modal-surface relative w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-lg font-bold">Order Details</h2>
            <p className="text-sm text-gray-500">#{orderId.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
            </div>
          ) : order ? (
            <>
              {/* Status Bar */}
              <div className="flex flex-wrap items-center gap-2 justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    order.paymentStatus === 'PAID' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-600 border border-gray-100'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {order.status === 'PENDING' && (
                    <button 
                      onClick={() => handleStatusUpdate('SHIPPED')}
                      disabled={updating}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <Truck className="w-4 h-4" /> Mark Shipped
                    </button>
                  )}
                  {order.status === 'SHIPPED' && (
                    <button 
                      onClick={() => handleStatusUpdate('COMPLETED')}
                      disabled={updating}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Complete
                    </button>
                  )}
                  {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                    <button 
                      onClick={() => handleStatusUpdate('CANCELLED')}
                      disabled={updating}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Customer</h3>
                  <div className="space-y-2">
                    <p className="font-medium text-lg">{order.customerName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" /> {order.customerEmail || 'No email'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" /> {order.customerPhone || 'No phone'}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Shipping Address</h3>
                  <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{order.shippingAddress || 'No shipping address provided'}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Items</h3>
                <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-500">Product</th>
                        <th className="px-4 py-3 font-medium text-gray-500 text-right">Qty</th>
                        <th className="px-4 py-3 font-medium text-gray-500 text-right">Price</th>
                        <th className="px-4 py-3 font-medium text-gray-500 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {order.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                {item.image ? (
                                  <MediaRenderer
                                    kind="image"
                                    src={item.image}
                                    alt={item.productName}
                                    maxHeightClassName="max-h-10"
                                    maxWidthClassName="max-w-10"
                                    className="rounded-lg"
                                    mediaClassName="rounded-lg"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.variant && <p className="text-xs text-gray-500">{item.variant}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(Number(item.price), order.currency)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(item.price) * item.quantity, order.currency)}</td>
                        </tr>
                      ))}
                      {!order.items?.length && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No items found</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800/50 font-medium">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right text-lg">{formatCurrency(Number(order.totalAmount), order.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </>
          ) : (
            <div className="text-center py-12 text-gray-500">Order not found</div>
          )}
        </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default OrderDetailsModal;
