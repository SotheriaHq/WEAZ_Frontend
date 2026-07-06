import { describe, expect, it } from 'vitest';

import { isUuidV4, normalizeUuidV4List } from '@/utils/uuid';

describe('uuid helpers', () => {
  it('keeps backend-safe UUID v4 ids and drops temporary client ids', () => {
    const collectionId = 'a85b9283-8eb7-4afa-aded-6702eb9cd87b';

    expect(isUuidV4(collectionId)).toBe(true);
    expect(isUuidV4('task_a85b9283-8eb7-4afa-aded-6702eb9cd87b')).toBe(false);
    expect(isUuidV4('mly8cp3-abc123')).toBe(false);

    expect(
      normalizeUuidV4List([
        collectionId,
        'task_a85b9283-8eb7-4afa-aded-6702eb9cd87b',
        'mly8cp3-abc123',
        collectionId,
        '',
        null,
      ]),
    ).toEqual([collectionId]);
  });
});
