import React, { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DesignViewModal from '@/components/designs/DesignViewModal';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import DesignApi from '@/api/DesignApi';
import useCachedResource from '@/hooks/useCachedResource';
import { fetchCollectionDetailQuery } from '@/query/queries';
import { toDesignMarketItem } from '@/utils/designMarketItem';
import { isLocalPublishTaskId } from '@/utils/publishTracker';
import { queryKeys } from '@/query/queryKeys';

const DesignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Where closing this design should land.
   *
   * It went to `/runway` unconditionally, which is fine when the design WAS
   * opened from the runway and wrong everywhere else. Following a design
   * reference out of a conversation and being dropped into the feed costs the
   * reader their place in the thread and gives them no way back to it — the
   * exact reason a reference is easier to ignore than to follow.
   *
   * `returnTo` is set by whoever navigated here. It is validated as a
   * same-origin PATH before use: a caller-supplied destination that could carry
   * an absolute URL is an open-redirect, and this one arrives through router
   * state that anything on the page can set.
   */
  const returnTo = (() => {
    const candidate = (location.state as { returnTo?: unknown } | null)?.returnTo;
    if (typeof candidate !== 'string') return null;
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
    return candidate;
  })();

  const closeTo = returnTo ?? '/runway';
  /*
    Name the destination on the chip. A reader who opened this from their Tags
    is going back to their Tags, and the control should say so rather than
    offering to close the design.
  */
  const backLabel = (() => {
    if (!returnTo) return null;
    if (returnTo.startsWith('/profile')) return 'Tags';
    if (returnTo.startsWith('/messages')) return 'Messages';
    if (returnTo.startsWith('/market')) return 'Market';
    if (returnTo.startsWith('/search')) return 'Search';
    return 'Back';
  })();
  const queryClient = useQueryClient();
  const openMediaId = searchParams.get('openMedia');
  const isLocalTaskRoute = isLocalPublishTaskId(id);

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
    enabled: Boolean(id) && !isLocalTaskRoute,
  });

  const item = useMemo(
    () => (detail ? toDesignMarketItem(detail, openMediaId) : null),
    [detail, openMediaId],
  );

  /*
    Hand the detail we already have to the viewer's cache.

    `DesignViewModal` builds its carousel by fetching the design AGAIN, under
    `brand.collectionDetail`, and falls back to a single image when that fetch
    comes back empty or throws — which is exactly what a reader sees as "the
    modal opened but there is only the front image, none of the others". This
    page has the full `medias` array in hand by then, under a different key. So
    give it to the keys the viewer reads instead of making it ask twice: the
    carousel is then populated from the same payload that rendered the page, and
    a design reachable only through the legacy fallback above still gets all of
    its frames.
  */
  useEffect(() => {
    if (!detail) return;
    const cacheIds = new Set<string>();
    if (id) cacheIds.add(id);
    if (item?.collectionId) cacheIds.add(item.collectionId);
    cacheIds.forEach((cacheId) => {
      queryClient.setQueryData(queryKeys.brand.collectionDetail(cacheId, 'design'), detail);
      queryClient.setQueryData(queryKeys.design.detail(cacheId), detail);
    });
  }, [detail, id, item?.collectionId, queryClient]);

  const error = useMemo(() => {
    if (!id) return 'Design reference is missing.';
    if (isLocalTaskRoute) {
      return 'This upload is still local to your browser. Open it from your Drafts or In Review tab once upload finishes.';
    }
    if (fetchError) {
      return fetchError.message === 'Design not found.'
        ? 'Design not found.'
        : fetchError.message;
    }
    if (!loading && detail && !item) {
      return 'This design does not have display media yet.';
    }
    return null;
  }, [detail, fetchError, id, isLocalTaskRoute, item, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <MuseLoader size={32} />
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
          to={closeTo}
          className="rounded-full bg-[color:var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--surface-primary)]"
        >
          {returnTo ? 'Back' : 'Back to market'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <DesignViewModal
        open
        item={item}
        backLabel={backLabel}
        onClose={() => navigate(closeTo)}
      />
    </div>
  );
};

export default DesignDetailsPage;
