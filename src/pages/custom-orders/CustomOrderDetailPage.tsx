import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BuyerCustomOrderDetailView } from '@/pages/profile/tabs/OrdersPanel';

const CustomOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  if (!orderId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500 dark:text-slate-400">
        Custom order not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BuyerCustomOrderDetailView
        orderId={orderId}
        onBack={() => navigate('/custom-orders')}
      />
    </div>
  );
};

export default CustomOrderDetailPage;
