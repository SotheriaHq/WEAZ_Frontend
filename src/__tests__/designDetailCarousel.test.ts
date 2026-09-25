import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

/**
 * The content viewer's carousel, and the cache short-circuit it depends on.
 *
 * The bug this pins: `fetchCollectionDetailQuery` reads
 * `queryKeys.design.detail(collectionId)` with `getQueryData`, which ignores
 * staleness, and returns whatever it finds WITHOUT fetching. `DesignViewModal`
 * builds its media list from that call and gates its arrows on
 * `mediaItems.length > 1`.
 *
 * So anything that writes a payload under that key decides what the carousel
 * shows — forever, because `design` is a persisted query root and the entry
 * survives reloads. A page once wrote its own (route-id) payload under the
 * COLLECTION's key to save a request; every carousel collapsed to its cover
 * image and no refresh could clear it.
 *
 * The rule these tests hold: a cached design detail is only good enough to
 * serve if it actually carries frames. Falling through costs one request and
 * cannot be wrong.
 */

const getDesignDetail = vi.fn();

vi.mock('@/api/DesignApi', () => ({
  DesignApi: { getDesignDetail: (...args: unknown[]) => getDesignDetail(...args) },
  default: { getDesignDetail: (...args: unknown[]) => getDesignDetail(...args) },
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: { getCollectionDetail: vi.fn() },
}));

const DESIGN_ID = '11111111-1111-4111-8111-111111111111';
const FULL_DETAIL = {
  id: DESIGN_ID,
  medias: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' }],
};

describe('design detail cache short-circuit', () => {
  beforeEach(() => {
    getDesignDetail.mockReset();
    getDesignDetail.mockResolvedValue(FULL_DETAIL);
  });

  it('serves a cached detail that carries its frames, without refetching', async () => {
    const { fetchCollectionDetailQuery } = await import('@/query/queries');
    const { queryKeys } = await import('@/query/queryKeys');
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.design.detail(DESIGN_ID), FULL_DETAIL);

    const result = await fetchCollectionDetailQuery(queryClient, DESIGN_ID, 'design');

    expect((result as typeof FULL_DETAIL).medias).toHaveLength(5);
    expect(getDesignDetail).not.toHaveBeenCalled();
  });

  it('refetches instead of serving a cached detail with no frames', async () => {
    const { fetchCollectionDetailQuery } = await import('@/query/queries');
    const { queryKeys } = await import('@/query/queryKeys');
    const queryClient = new QueryClient();
    // Exactly what the broken page wrote: a real payload, wrong media set.
    queryClient.setQueryData(queryKeys.design.detail(DESIGN_ID), { id: DESIGN_ID, medias: [] });

    const result = await fetchCollectionDetailQuery(queryClient, DESIGN_ID, 'design');

    // The carousel gets all five frames back rather than the cover alone.
    expect((result as typeof FULL_DETAIL).medias).toHaveLength(5);
    expect(getDesignDetail).toHaveBeenCalledWith(DESIGN_ID);
  });

  it('refetches when the cached entry is not a design payload at all', async () => {
    const { fetchCollectionDetailQuery } = await import('@/query/queries');
    const { queryKeys } = await import('@/query/queryKeys');
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.design.detail(DESIGN_ID), { id: DESIGN_ID });

    await fetchCollectionDetailQuery(queryClient, DESIGN_ID, 'design');

    expect(getDesignDetail).toHaveBeenCalledWith(DESIGN_ID);
  });
});
