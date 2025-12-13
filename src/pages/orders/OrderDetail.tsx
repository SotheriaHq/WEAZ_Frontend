import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMyOrder, type Order } from '@/api/StoreApi';
import { toast } from 'sonner';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const data = await getMyOrder(orderId);
        setOrder(data as any);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Order not found');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

  if (loading) {
    return <div className="max-w-4xl mx-auto py-10 px-4">Loading...</div>;
  }

  if (!order) {
    return <div className="max-w-4xl mx-auto py-10 px-4">Order not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <button className="text-sm text-gray-500 hover:text-black" onClick={() => navigate(-1)}>Back</button>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Order ID</p>
            <p className="font-mono text-lg">#{order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-xl font-semibold">
              {new Intl.NumberFormat('en-NG', { style: 'currency', currency: order.currency || 'NGN' }).format(Number(order.totalAmount))}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500">Placed on {new Date(order.createdAt).toLocaleString()}</div>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <p className="font-medium">{item.name}</p>
                <div className="text-gray-500 flex gap-2">
                  {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                  {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Qty {item.quantity}</p>
                <p className="font-medium">
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: order.currency || 'NGN' }).format(Number(item.price) * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
