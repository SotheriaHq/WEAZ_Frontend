import { describe, expect, it } from 'vitest';
import {
  PRIVATE_QUERY_ROOTS,
  isPersistableWiezQueryKey,
  queryKeys,
} from './queryKeys';

/**
 * What survives a reload, and what must never reach localStorage.
 *
 * The persistence list is the difference between a returning user seeing their
 * content immediately and seeing a cold skeleton, so it is worth pinning. It is
 * also the only place where a careless addition would write order addresses or
 * payout data to disk, so the exclusions are pinned just as hard.
 */
describe('isPersistableWiezQueryKey', () => {
  it('persists the profile tabs users round-trip between', () => {
    expect(isPersistableWiezQueryKey(queryKeys.reviews.brand('brand_1'))).toBe(true);
    expect(isPersistableWiezQueryKey(queryKeys.reviews.mine())).toBe(true);
    expect(isPersistableWiezQueryKey(['patches', 'user_1', 'owner'])).toBe(true);
    expect(isPersistableWiezQueryKey(['saved', 'me'])).toBe(true);
  });

  it('persists every owner catalog tab, drafts included', () => {
    // Drafts was the one catalog tab left out, so it cold-loaded after a reload
    // while Public/Private repainted instantly from `brand.collections`.
    expect(isPersistableWiezQueryKey(queryKeys.brand.myDrafts('user_1'))).toBe(true);
    expect(isPersistableWiezQueryKey(['brand', 'draft-collections'])).toBe(true);
    expect(
      isPersistableWiezQueryKey(queryKeys.brand.collections('user_1', { visibility: 'private' })),
    ).toBe(true);
    expect(isPersistableWiezQueryKey(queryKeys.brand.profile('brand_1'))).toBe(true);
  });

  it('keeps PII and money off disk', () => {
    expect(isPersistableWiezQueryKey(['profile', 'orders', 'me'])).toBe(false);
    expect(isPersistableWiezQueryKey(['orders', 'detail', 'order_1'])).toBe(false);
    expect(isPersistableWiezQueryKey(queryKeys.brand.finance('user_1'))).toBe(false);
    expect(isPersistableWiezQueryKey(queryKeys.auth.profile())).toBe(false);
    expect(isPersistableWiezQueryKey(queryKeys.messaging.inbox('user_1'))).toBe(false);
  });

  it('does not persist per-card saved probes', () => {
    // Hundreds of tiny entries would crowd real content out of the 4MB budget.
    expect(isPersistableWiezQueryKey(queryKeys.saved.status('DESIGN', 'd_1'))).toBe(false);
    expect(isPersistableWiezQueryKey(queryKeys.saved.batch('DESIGN', ['d_1']))).toBe(false);
  });

  it('purges on logout everything it is willing to persist', () => {
    // The invariant that makes persisting user-scoped data safe at all: if it
    // can reach disk, logout has to be able to take it off disk.
    const persistablePrivateSamples: ReadonlyArray<readonly unknown[]> = [
      queryKeys.reviews.brand('brand_1'),
      queryKeys.reviews.mine(),
      ['patches', 'user_1', 'owner'],
      ['saved', 'me'],
      queryKeys.brand.myDrafts('user_1'),
      queryKeys.brand.collections('user_1', { visibility: 'private' }),
      queryKeys.brand.profile('brand_1'),
    ];

    for (const key of persistablePrivateSamples) {
      expect(isPersistableWiezQueryKey(key)).toBe(true);
      expect(PRIVATE_QUERY_ROOTS.has(String(key[0]))).toBe(true);
    }
  });
});
