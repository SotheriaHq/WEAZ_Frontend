import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DesignApi from '@/api/DesignApi';
import { brandApi } from '@/api/BrandApi';
import DesignViewModal from '@/components/designs/DesignViewModal';
import VLoader from '@/components/loaders/VLoader';
import type { MarketItem } from '@/types/market';
import { toDesignMarketItem } from '@/utils/designMarketItem';

const DesignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const openMediaId = searchParams.get('openMedia');

  useEffect(() => {
    if (!id) {
      setError('Design reference is missing.');
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadDesign = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await DesignApi.getDesignDetail(id);
        const nextItem = toDesignMarketItem(detail, openMediaId);
        if (!mounted) return;
        if (nextItem) {
          setItem(nextItem);
          return;
        }
        setError('This design does not have display media yet.');
      } catch {
        try {
          const legacyDetail = await brandApi.getCollectionDetail(id, { scope: 'design' });
          const nextItem = toDesignMarketItem(legacyDetail, openMediaId);
          if (!mounted) return;
          if (nextItem) {
            setItem(nextItem);
            return;
          }
          setError('This design does not have display media yet.');
        } catch {
          if (mounted) {
            setError('Design not found.');
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDesign();
    return () => {
      mounted = false;
    };
  }, [id, openMediaId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <VLoader size={32} phase="loading" label="Loading design..." />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-theme">Design unavailable</h1>
        <p className="text-sm text-theme-secondary">{error ?? 'This design could not be opened.'}</p>
        <Link
          to="/market"
          className="rounded-full bg-[color:var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--surface-primary)]"
        >
          Back to market
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <DesignViewModal
        open
        item={item}
        onClose={() => navigate('/market')}
      />
    </div>
  );
};

export default DesignDetailsPage;
