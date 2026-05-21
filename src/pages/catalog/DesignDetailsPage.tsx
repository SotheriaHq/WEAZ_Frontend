import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DesignViewModal from '@/components/designs/DesignViewModal';
import VLoader from '@/components/loaders/VLoader';
import type { MarketItem } from '@/types/market';
import { toDesignMarketItem } from '@/utils/designMarketItem';
import { fetchCollectionDetailQuery, useDesignDetailQuery } from '@/query/queries';

const DesignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<unknown | null>(null);
  const [item, setItem] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const openMediaId = searchParams.get('openMedia');
  const designQuery = useDesignDetailQuery(id, { enabled: Boolean(id) });

  useEffect(() => {
    if (!id) {
      setError('Design reference is missing.');
      setLoading(false);
      return;
    }

    let mounted = true;
    const applyDetail = (nextDetail: unknown) => {
      const nextItem = toDesignMarketItem(nextDetail, openMediaId);
      if (nextItem) {
        setDetail(nextDetail);
        setItem(nextItem);
        setError(null);
        return true;
      }
      return false;
    };

    const loadFallback = async () => {
      setError(null);
      try {
        const legacyDetail = await fetchCollectionDetailQuery(queryClient, id, 'design');
        if (!mounted) return;
        if (!applyDetail(legacyDetail)) setError('This design does not have display media yet.');
      } catch {
        if (mounted) setError('Design not found.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (designQuery.data !== undefined) {
      if (!applyDetail(designQuery.data)) setError('This design does not have display media yet.');
      setLoading(false);
    } else if (designQuery.error) {
      void loadFallback();
    } else {
      setLoading(designQuery.isLoading && !item);
    }

    return () => {
      mounted = false;
    };
  }, [designQuery.data, designQuery.error, designQuery.isLoading, id, item, openMediaId, queryClient]);

  useEffect(() => {
    if (!detail) return;
    const nextItem = toDesignMarketItem(detail, openMediaId);
    if (nextItem) setItem(nextItem);
  }, [detail, openMediaId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <VLoader size={32} phase="loading" showLabel={false} />
        <p className="text-sm font-medium text-theme-secondary">Loading design...</p>
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
