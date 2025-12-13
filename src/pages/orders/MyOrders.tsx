import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Package, Truck } from 'lucide-react';

const statusIcon = (status: string) => {
  switch (status) {
    case 'SHIPPED':
      return <Truck className="w-4 h-4" />;
    case 'DELIVERED':
      return <BadgeCheck className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
};

const statusTone = (status: string) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-green-100 text-green-700';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const MyOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await getMyOrders(page, 10);
      const items = (res as any)?.items || (res as any)?.data || [];
      setOrders(items);
      setTotalPages((res as any)?.totalPages || 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Orders</h1>
          <p className="text-gray-500 text-sm">Track everything you have purchased.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Clock className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">You have not placed any orders yet.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono text-gray-800 dark:text-gray-200">#{order.id.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="font-medium text-lg">{order.customerName}</div>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                    {order.items.slice(0, 3).map((item) => (
                      <span key={item.productId} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        {item.name} × {item.quantity}
                      </span>
                    ))}
                    {order.items.length > 3 && <span className="text-gray-400">+{order.items.length - 3} more</span>}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusTone(order.status)}`}>
                    {statusIcon(order.status)}
                    {order.status}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: order.currency || 'NGN' }).format(Number(order.totalAmount))}
                    </div>
                    <button
                      className="text-sm text-black dark:text-white hover:underline"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      View details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyOrders;
