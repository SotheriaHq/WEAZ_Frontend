import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { customOrdersBuyerApi, type CustomOrderCheckoutSession } from '@/api/CustomOrderApi';

const CustomOrderCheckoutResumePage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CustomOrderCheckoutSession | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await customOrdersBuyerApi.getCheckoutSessionByToken(token);
        if (!active) return;
        setSession(data);
      } catch (error: any) {
        if (!active) return;
        setSession(null);
        toast.error(error?.response?.data?.message || 'Unable to resume this checkout session.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!session) return;
    if (session.customOrderId) {
      navigate(
        `/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(session.customOrderId)}`,
        { replace: true },
      );
      return;
    }
    if (session.resumePath) {
      // Validate that resumePath is a relative path before navigating to prevent
      // open-redirect issues if the stored value is an absolute URL.
      const path = session.resumePath;
      const safePath = typeof path === 'string' && path.startsWith('/') ? path : '/profile?tab=orders';
      navigate(safePath, { replace: true });
    }
  }, [navigate, session]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-5 text-5xl">⏳</div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Resuming checkout</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Pulling your latest payment session details.
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-5 text-5xl">🧾</div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Checkout session not found</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This resume link is no longer available. Start a fresh custom order to continue.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate('/custom-orders/new')}>Start new custom order</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-5 text-5xl">🧵</div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Checkout ready to resume</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        We found your last payment session. If you were not redirected automatically, you can continue below.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {session.resumePath ? (
          <Button
            onClick={() => {
              const path = session.resumePath;
              const safePath = typeof path === 'string' && path.startsWith('/') ? path : '/profile?tab=orders';
              navigate(safePath);
            }}
          >
            Continue payment
          </Button>
        ) : (
          <Button onClick={() => navigate('/custom-orders/new')}>Start new custom order</Button>
        )}
        <Button variant="secondary" onClick={() => navigate('/profile?tab=orders')}>
          Open my orders
        </Button>
      </div>
    </div>
  );
};

export default CustomOrderCheckoutResumePage;
