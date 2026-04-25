import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { resolveOrderAccess } from '@/api/StoreApi';
import VLoader from '@/components/loaders/VLoader';

const OrderAccessResolverPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!orderId) {
        setError('Order not found.');
        return;
      }

      try {
        const resolution = await resolveOrderAccess(orderId);
        if (!active) return;
        setTarget(resolution.destination);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.message || 'You do not have access to this order.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [orderId]);

  if (target) {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center px-4 text-center">
      <div className="space-y-4">
        <div className="text-4xl">{error ? '⚠️' : '🧭'}</div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {error ? 'Order unavailable' : 'Opening order'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {error || 'Checking which order workspace you can access.'}
          </p>
        </div>
        {!error ? <VLoader size={52} phase="loading" /> : null}
        {error ? (
          <button
            type="button"
            onClick={() => navigate('/profile?tab=orders')}
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
          >
            Go to my orders
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default OrderAccessResolverPage;
