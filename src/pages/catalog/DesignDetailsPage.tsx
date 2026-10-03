import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DesignViewModal from '@/components/designs/DesignViewModal';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import DesignApi from '@/api/DesignApi';
import useCachedResource from '@/hooks/useCachedResource';
import { fetchCollectionDetailQuery } from '@/query/queries';
import { toDesignMarketItem } from '@/utils/designMarketItem';
import { isLocalPublishTaskId } from '@/utils/publishTracker';

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
    DO NOT seed the viewer's media cache from this page.

    A previous attempt here wrote this page's payload into
    `queryKeys.design.detail(...)` and `queryKeys.brand.collectionDetail(...)`,
    meaning to save the viewer a second fetch. It broke the carousel instead,
    and this is the shape of the trap:

    `fetchCollectionDetailQuery` SHORT-CIRCUITS on `design.detail(collectionId)`
    and returns whatever it finds there without fetching. `DesignViewModal`
    builds its media list by calling it with `item.collectionId` — the
    COLLECTION the design belongs to, which is what carries every frame. This
    page fetched by the ROUTE id. Writing the route id's payload under the
    collection's key handed the viewer the wrong media set, so the carousel
    collapsed to the cover and the arrows (gated on `mediaItems.length > 1`)
    disappeared with it.

    `design` is also a PERSISTED query root, so that write reached localStorage
    and survived reloads — a wrong answer that could not be cleared by
    refreshing.

    The viewer owns its own media fetch. Leave it alone: one extra request is
    worth far less than the carousel.
  */

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
