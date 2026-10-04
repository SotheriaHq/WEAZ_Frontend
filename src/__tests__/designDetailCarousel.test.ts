import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

/**
 * The second way this carousel broke: the frames were all loaded and the
 * controls were all rendered, and you still could not reach them.
 *
 * `CONTENT_DISPLAY_FRAME_CLASS` is `overflow-y-auto`, and it holds an
 * `object-cover` image at `h-auto min-h-full` — so its content is routinely
 * taller than the box. An absolutely-positioned CHILD of a scroll container is
 * placed against that content, not against the visible window: `top-1/2` put
 * the arrows halfway down an image you can see the top of, and `bottom-3` put
 * the counter below the fold. The viewer reported "1 / 5 and no way to see the
 * others" with both arrows present in the DOM the whole time.
 */
describe('the content viewer controls', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/designs/DesignViewModal.tsx'),
    'utf8',
  );

  it('keeps the arrows out of the scrolling frame', () => {
    const frame = source.indexOf('className={CONTENT_DISPLAY_FRAME_CLASS}');
    const arrow = source.indexOf('aria-label="Previous image"', frame);
    expect(frame).toBeGreaterThan(-1);
    expect(arrow).toBeGreaterThan(frame);

    /*
      Count the div tags between the scroller's opening tag and the first
      arrow. More closes than opens means the scroller CLOSED first, so the
      arrow is its sibling and is placed against the visible box. Otherwise the
      arrow is still inside it, positioned against content that scrolls — which
      is the bug: the control exists, and you have to scroll to reach it.
    */
    const between = source.slice(frame, arrow);
    const opens = (between.match(/<div\b/g) ?? []).length;
    const closes = (between.match(/<\/div>/g) ?? []).length;

    expect(between).toContain('<MediaRenderer');
    expect(closes).toBeGreaterThan(opens);
  });

  it('lets the media scroll inside the wrapper that carries the overlay', () => {
    /*
      Taking the arrows out of the scroller put a NON-scrolling wrapper between
      the grid and the frame, and that wrapper silently switched the scroll off.
      A grid item's automatic minimum size is its content, and only a scroll
      container has that minimum reduced to zero — the frame used to be the grid
      item, so it did. The wrapper does not, so the row grew to the full height
      of the image and the frame, at 100% of a parent as tall as its own
      content, had nothing left to scroll.

      Read the wrapper as the div immediately before the frame's opening tag.
    */
    const frame = source.indexOf('className={CONTENT_DISPLAY_FRAME_CLASS}');
    expect(frame).toBeGreaterThan(-1);

    const before = source.slice(0, frame);
    const wrapper = before.lastIndexOf('<div className="');
    const wrapperClass = /^<div className="([^"]*)"/.exec(before.slice(wrapper))?.[1] ?? '';

    expect(wrapperClass).toMatch(/\bmin-h-0\b/);
    expect(wrapperClass).toMatch(/\bh-full\b/);
  });

  it('stacks every overlay control above the media', () => {
    // Without an explicit stacking index an overlay can sit under the media it
    // is drawn on top of — a click that silently does nothing.
    const buttons = [
      ...source.matchAll(/aria-label="(?:Previous|Next) image"\s*className="([^"]*)"/g),
    ];
    // Two arrows on each of the two layouts.
    expect(buttons).toHaveLength(4);
    for (const [, className] of buttons) {
      expect(className).toMatch(/\bz-10\b/);
    }
  });

  it('calls every hook above the early return', () => {
    /*
      `DesignViewModal` returns null while it is closed. A hook placed BELOW
      that return runs only while the modal is open, so opening it renders more
      hooks than the closed render did — React #310, "Rendered more hooks than
      during the previous render", which crashes the whole page rather than the
      modal.

      `react-hooks/rules-of-hooks` catches this too, and is the faster signal;
      this exists because the rule only helps if someone runs the linter.
    */
    const guard = source.indexOf('if (!open || !item) return null;');
    expect(guard).toBeGreaterThan(-1);

    const after = source.slice(guard);
    expect(after).not.toMatch(/\bReact\.use[A-Z]\w*\(/);
    expect(after).not.toMatch(/^\s*const .*= use[A-Z]\w*\(/m);
  });

  it('walks the frames with the arrow keys, except while typing', () => {
    expect(source).toMatch(/window\.addEventListener\('keydown'/);
    expect(source).toContain("event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'");
    // The comment box keeps its own arrows for moving the caret.
    expect(source).toMatch(/input, textarea, select, \[contenteditable="true"\]/);
    expect(source).toMatch(/window\.removeEventListener\('keydown'/);
  });
});
