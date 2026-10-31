import { describe, expect, it } from 'vitest';
import { collectionListChanged, countCatalogTaskBucket, resolveCatalogTaskBucket } from './catalogTaskStatus';

describe('catalog task ownership', () => {
  it.each(['draft', 'publish'] as const)('keeps failed %s attempts out of review', (action) => {
    expect(resolveCatalogTaskBucket({ action, status: 'failed' })).toBe('FAILED');
  });
  it('counts a failed attempt exactly once even if an old review response includes its design', () => {
    const task = { id: 'task', designId: 'design', action: 'publish' as const, status: 'failed', updatedAt: 1 };
    expect(countCatalogTaskBucket([{ id: 'design' }], [task], 'IN_REVIEW')).toBe(0);
    expect(countCatalogTaskBucket([{ id: 'design' }], [task], 'FAILED')).toBe(1);
  });
});

describe('collectionListChanged', () => {
  const row = (overrides = {}) => ({ id: 'a', coverFileId: null, itemCount: 0, title: 'Drimmer', draftReason: null, coverImage: 'https://cdn/a?sig=1', ...overrides });

  it('picks up media landing on a row whose id did not change', () => {
    expect(collectionListChanged([row()], [row({ coverFileId: 'file-1', itemCount: 5 })])).toBe(true);
  });

  it('picks up a failed upload being marked or cleared', () => {
    expect(collectionListChanged([row()], [row({ draftReason: 'UPLOAD_INCOMPLETE' })])).toBe(true);
  });

  it('ignores a rotated signed URL, so cards do not remount and refetch', () => {
    expect(collectionListChanged([row()], [row({ coverImage: 'https://cdn/a?sig=2' })])).toBe(false);
  });
});
