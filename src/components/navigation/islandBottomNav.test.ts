import { describe, expect, it } from 'vitest';

import {
  resolveIslandCapacity,
  splitIslandItems,
  type IslandBottomNavItem,
} from './IslandBottomNav';

const item = (key: string, active = false): IslandBottomNavItem => ({
  key,
  label: key,
  path: `/${key}`,
  active,
});

/**
 * The row width the island actually gets, for a given viewport.
 *
 * The pill is `w-[calc(100vw-32px)]` capped by `maxWidthClassName`, with
 * `p-1.5` (12px total) inside it. Mirrored here so the expectations below are
 * pinned to real devices rather than to arbitrary numbers.
 */
const rowWidthFor = (viewport: number, cap: number) =>
  Math.min(viewport - 32, cap) - 12;

const MAIN_DOCK_CAP = 420;
const STUDIO_DOCK_CAP = 560;

describe('resolveIslandCapacity', () => {
  it('shows nothing beyond the slot cap, however wide the row', () => {
    // A tablet under `lg` can fit eight 64px chips. Eight is a menu bar, not a
    // dock — past six the reader scans instead of aiming.
    expect(resolveIslandCapacity(rowWidthFor(1000, STUDIO_DOCK_CAP), 9)).toBe(6);
    expect(resolveIslandCapacity(10_000, 20)).toBe(6);
  });

  it('fits five chips on a 360px phone and six on a large one', () => {
    expect(resolveIslandCapacity(rowWidthFor(360, STUDIO_DOCK_CAP), 9)).toBe(5);
    expect(resolveIslandCapacity(rowWidthFor(430, STUDIO_DOCK_CAP), 9)).toBe(6);
  });

  it('fits the whole main dock on a 360px phone', () => {
    // Runway, Market, Subs, Messages, Size Charts, Profile — six, because
    // Messages only exists for a signed-in reader. The fifth and sixth used to
    // be off the right edge with nothing saying so; five get chips and the
    // remainder is one visible tap away instead of invisible.
    expect(resolveIslandCapacity(rowWidthFor(360, MAIN_DOCK_CAP), 6)).toBe(5);
    expect(resolveIslandCapacity(rowWidthFor(360, MAIN_DOCK_CAP), 5)).toBe(5);
  });

  it('never returns zero on a very narrow screen', () => {
    // One reachable chip plus More beats a row of nothing.
    expect(resolveIslandCapacity(40, 5)).toBe(1);
  });

  it('assumes everything fits before the first measurement', () => {
    // `useLayoutEffect` corrects this before paint; it must not flash a More
    // chip that the measured width then removes.
    expect(resolveIslandCapacity(0, 4)).toBe(4);
    expect(resolveIslandCapacity(0, 9)).toBe(6);
  });
});

describe('splitIslandItems', () => {
  it('keeps every item visible when they all fit', () => {
    const items = [item('a'), item('b'), item('c')];
    const { visibleItems, overflowItems } = splitIslandItems(items, 5, null);

    expect(visibleItems).toHaveLength(3);
    expect(overflowItems).toHaveLength(0);
  });

  it('reserves one slot for the More chip when it overflows', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => item(key));
    const { visibleItems, overflowItems } = splitIslandItems(items, 5, null);

    // Five slots, one of which is More — so four chips, not five.
    expect(visibleItems.map((entry) => entry.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(overflowItems.map((entry) => entry.key)).toEqual(['e', 'f', 'g']);
  });

  it('loses no item to the split', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((key) => item(key));
    const { visibleItems, overflowItems } = splitIslandItems(items, 5, null);

    expect([...visibleItems, ...overflowItems].map((entry) => entry.key).sort()).toEqual(
      items.map((entry) => entry.key).sort(),
    );
  });

  it('promotes the selected item out of the sheet', () => {
    // Finance is last in the Studio dock. Opening it must not leave the row
    // with no highlight and the current section hidden behind a menu.
    const items = ['a', 'b', 'c', 'd', 'e', 'finance'].map((key) =>
      item(key, key === 'finance'),
    );
    const { visibleItems, overflowItems } = splitIslandItems(items, 5, null);

    expect(visibleItems.map((entry) => entry.key)).toEqual(['a', 'b', 'c', 'finance']);
    // Both lists still read in declared order — the displaced item heads the
    // sheet rather than dropping into the hole the promoted one left.
    expect(overflowItems.map((entry) => entry.key)).toEqual(['d', 'e']);
  });

  it('promotes on the optimistic key before the route has caught up', () => {
    // A press lights up immediately; the highlight must be on the ROW at that
    // moment, not one navigation later.
    const items = ['a', 'b', 'c', 'd', 'e', 'finance'].map((key) => item(key));
    const { visibleItems } = splitIslandItems(items, 5, 'finance');

    expect(visibleItems.map((entry) => entry.key)).toContain('finance');
  });

  it('always leaves one real chip beside More', () => {
    const items = ['a', 'b', 'c'].map((key) => item(key));
    const { visibleItems, overflowItems } = splitIslandItems(items, 1, null);

    expect(visibleItems).toHaveLength(1);
    expect(overflowItems).toHaveLength(2);
  });
});
