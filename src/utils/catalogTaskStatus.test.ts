import { describe, expect, it } from 'vitest';
import { countCatalogTaskBucket, resolveCatalogTaskBucket } from './catalogTaskStatus';

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
