import { describe, expect, it } from 'vitest';
import { normalizePrimary, reorderItems, setPrimary, validateMedia } from '../pages/studio/products/mediaUtils';

describe('product media utils', () => {
  it('auto-selects first image as cover when none set', () => {
    const items = normalizePrimary([{ id: 'a' }, { id: 'b' }]);
    expect(items[0].isPrimary).toBe(true);
    expect(items[1].isPrimary).toBe(false);
  });

  it('enforces cover required when images exist', () => {
    const result = validateMedia([{ id: 'a', isPrimary: false }], 4);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cover');
  });

  it('enforces max 4 images', () => {
    const result = validateMedia(
      [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
      4,
    );
    expect(result.ok).toBe(false);
  });

  it('reorders items without changing cover', () => {
    const items = setPrimary([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b');
    const reordered = reorderItems(items, 1, 0);
    expect(reordered[0].id).toBe('b');
    expect(reordered[0].isPrimary).toBe(true);
  });
});
