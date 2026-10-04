import { describe, expect, it } from 'vitest';
import { buildMediaSlotMap, renderableMediaSlots } from './MediaSlotGrid';

const item = (id: string, viewSlot?: string | null) => ({
  id,
  url: `blob:${id}`,
  viewSlot,
});

describe('renderableMediaSlots', () => {
  it('is the required four followed by the optional extras', () => {
    expect(renderableMediaSlots(6)).toEqual([
      'FRONT',
      'BACK',
      'LEFT_SIDE',
      'RIGHT_SIDE',
      'DETAIL',
      'ON_MODEL',
    ]);
  });

  it('honours a smaller cap', () => {
    expect(renderableMediaSlots(4)).toEqual(['FRONT', 'BACK', 'LEFT_SIDE', 'RIGHT_SIDE']);
  });
});

describe('buildMediaSlotMap', () => {
  it('falls back to position when an item carries no slot', () => {
    const map = buildMediaSlotMap([item('a'), item('b'), item('c')]);

    expect(map.get('FRONT')?.id).toBe('a');
    expect(map.get('BACK')?.id).toBe('b');
    expect(map.get('LEFT_SIDE')?.id).toBe('c');
    expect(map.get('RIGHT_SIDE')).toBeUndefined();
  });

  it("prefers the item's own slot over its position", () => {
    const map = buildMediaSlotMap([item('a', 'RIGHT_SIDE'), item('b', 'FRONT')]);

    expect(map.get('RIGHT_SIDE')?.id).toBe('a');
    expect(map.get('FRONT')?.id).toBe('b');
  });

  it('spills a duplicate slot to the next free one instead of dropping it', () => {
    // Two items both claiming FRONT would collide in a Map — the second would
    // overwrite the first, and one image would simply disappear from the grid.
    const map = buildMediaSlotMap([item('a', 'FRONT'), item('b', 'FRONT'), item('c', 'FRONT')]);

    expect(map.size).toBe(3);
    expect([...map.values()].map((entry) => entry.id).sort()).toEqual(['a', 'b', 'c']);
    expect(map.get('FRONT')?.id).toBe('a');
  });

  it('relocates a slot the grid does not render', () => {
    // INSPIRATION and OTHER exist in the model but sit past the six rendered
    // tiles; an item tagged with one still has to appear somewhere.
    const map = buildMediaSlotMap([item('a', 'INSPIRATION')]);

    expect(map.size).toBe(1);
    expect(map.get('FRONT')?.id).toBe('a');
  });

  it('never loses an item, whatever the slots say', () => {
    const items = [
      item('a', 'DETAIL'),
      item('b'),
      item('c', 'DETAIL'),
      item('d', 'OTHER'),
      item('e'),
      item('f', 'FRONT'),
    ];

    const map = buildMediaSlotMap(items, 6);

    expect(map.size).toBe(items.length);
    expect(new Set([...map.values()].map((entry) => entry.id)).size).toBe(items.length);
  });

  it('returns an empty map for no media', () => {
    expect(buildMediaSlotMap([]).size).toBe(0);
  });

  it('carries the grid fields through untouched', () => {
    const file = new File(['x'], 'front.jpg', { type: 'image/jpeg' });
    const map = buildMediaSlotMap([
      { id: 'a', url: 'blob:a', kind: 'image', isCover: true, file, progress: 42 },
    ]);

    expect(map.get('FRONT')).toMatchObject({
      id: 'a',
      url: 'blob:a',
      kind: 'image',
      isCover: true,
      progress: 42,
      file,
    });
  });
});
