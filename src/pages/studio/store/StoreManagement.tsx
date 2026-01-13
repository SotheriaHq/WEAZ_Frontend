import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import StoreProductsPanel from '@/components/studio/store/StoreProductsPanel';

export default function StoreManagement() {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        const s = await getStoreStatus();
        if (!mounted) return;
        setStatus(s);

        if (s?.profile == null) {
          navigate('/studio/store/setup', { replace: true });
          return;
        }

        if (s?.isStoreOpen === false) {
          navigate('/studio/store/essentials', { replace: true });
        }
      } catch (e) {
        const code = (e as any)?.response?.status;
        if (code === 404) {
          navigate('/studio/store/setup', { replace: true });
          return;
        }
        toast.error('Failed to load store status');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="h-8 w-48 bg-gray-200/80 dark:bg-white/10 rounded mb-3 animate-pulse" />
        <div className="h-4 w-96 bg-gray-200/80 dark:bg-white/10 rounded animate-pulse" />
        <div className="mt-6 h-72 rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-6">
        <div className="text-gray-900 dark:text-white font-semibold">Store</div>
        <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">Unable to load store status.</div>
      </div>
    );
  }

  // If store isn't open, we already redirected to wizard.
  if (status.isStoreOpen === false) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage products and your store setup.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/studio/store/products/new')}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
          disabled={!user?.id}
        >
          Add Product
        </button>
      </div>

      <StoreProductsPanel />
    </div>
  );
}
