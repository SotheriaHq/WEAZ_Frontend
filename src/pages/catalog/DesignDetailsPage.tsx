import React, { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DesignViewModal from '@/components/designs/DesignViewModal';
import VLoader from '@/components/loaders/VLoader';
import DesignApi from '@/api/DesignApi';
import useCachedResource from '@/hooks/useCachedResource';
import { fetchCollectionDetailQuery } from '@/query/queries';
import { toDesignMarketItem } from '@/utils/designMarketItem';

const DesignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openMediaId = searchParams.get('openMedia');

  const {
    data: detail,
    loading,
    error: fetchError,
  } = useCachedResource<unknown>({
    queryKey: ['design', 'detail-page', id],
    queryFn: async () => {
      if (!id) throw new Error('Design reference is missing.');
      try {
        return await DesignApi.getDesignDetail(id);
      } catch {
        const legacyDetail = await fetchCollectionDetailQuery(queryClient, id, 'design');
        if (!legacyDetail) throw new Error('Design not found.');
        return legacyDetail;
      }
    },
    enabled: Boolean(id),
  });

  const item = useMemo(
    () => (detail ? toDesignMarketItem(detail, openMediaId) : null),
    [detail, openMediaId],
  );

  const error = useMemo(() => {
    if (!id) return 'Design reference is missing.';
    if (fetchError) {
      return fetchError.message === 'Design not found.'
        ? 'Design not found.'
        : fetchError.message;
    }
    if (!loading && detail && !item) {
      return 'This design does not have display media yet.';
    }
    return null;
  }, [detail, fetchError, id, item, loading]);

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