import { describe, expect, it } from 'vitest';
import {
  getSignedUrlIdentity,
  isEquivalentSignedUrl,
  replaceEqualDeepPreservingSignedUrls,
} from './structuralSharing';

const BASE = 'https://weaz-sit.s3.us-east-1.amazonaws.com/POST_IMAGE/user_1/cover.jpg';

/** A presigned GET shaped exactly like the ones UploadService issues. */
const signed = (issuedAt: string, signature: string, expiresSeconds = 604800) =>
  `${BASE}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA%2F20260808%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=${issuedAt}&X-Amz-Expires=${expiresSeconds}&X-Amz-SignedHeaders=host&X-Amz-Signature=${signature}`;

// Well clear of the 7-day window opened at 20260808T090000Z.
const DURING_VALIDITY = Date.UTC(2026, 7, 9, 9, 0, 0);

describe('getSignedUrlIdentity', () => {
  it('ignores the signature query and keys on the object path', () => {
    expect(getSignedUrlIdentity(signed('20260808T090000Z', 'aaa'))).toBe(BASE);
    expect(getSignedUrlIdentity(signed('20260808T091500Z', 'bbb'))).toBe(BASE);
  });

  it('returns null for URLs that are not signed', () => {
    // A stable CDN URL must compare as an ordinary string: if it ever changes,
    // it changed for a real reason and the UI should follow.
    expect(getSignedUrlIdentity('https://cdn.example/POST_IMAGE/cover.jpg')).toBeNull();
    expect(getSignedUrlIdentity('https://cdn.example/cover.jpg?v=2')).toBeNull();
    expect(getSignedUrlIdentity('not-a-url')).toBeNull();
    expect(getSignedUrlIdentity('')).toBeNull();
  });
});

describe('isEquivalentSignedUrl', () => {
  it('treats a re-signed URL for the same object as unchanged', () => {
    expect(
      isEquivalentSignedUrl(
        signed('20260808T090000Z', 'aaa'),
        signed('20260808T091500Z', 'bbb'),
        DURING_VALIDITY,
      ),
    ).toBe(true);
  });

  it('does not merge different objects', () => {
    const other = `${BASE.replace('cover.jpg', 'other.jpg')}?X-Amz-Signature=bbb&X-Amz-Date=20260808T091500Z&X-Amz-Expires=604800`;
    expect(
      isEquivalentSignedUrl(signed('20260808T090000Z', 'aaa'), other, DURING_VALIDITY),
    ).toBe(false);
  });

  it('takes the new URL when the cached one is close to expiry', () => {
    // The safety valve: holding a stale reference must never outlive the
    // signature it is holding, or the card would render a 403 instead.
    const shortLived = signed('20260808T090000Z', 'aaa', 3600);
    const almostExpired = Date.UTC(2026, 7, 8, 9, 30, 0); // 30 min left, margin is 60
    expect(
      isEquivalentSignedUrl(shortLived, signed('20260808T093000Z', 'bbb'), almostExpired),
    ).toBe(false);
  });
});

/*
  Tree fixtures are issued RELATIVE TO NOW.

  `replaceEqualDeepPreservingSignedUrls` reads the real clock -- it has no `now`
  parameter, because in the app the comparison always happens against the real
  clock. A hardcoded signing date therefore gives these fixtures a shelf life:
  `20260808T090000Z` plus the default 7-day expiry meant that from 2026-08-15
  every fixture below looked expired, the implementation correctly declined to
  preserve the cached URL, and the suite blamed the code.
*/
const amzDate = (ms: number) =>
  new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const ISSUED_AT = amzDate(Date.now() - 60_000);
const RESIGNED_AT = amzDate(Date.now() - 30_000);

describe('replaceEqualDeepPreservingSignedUrls', () => {
  it('keeps the whole tree by reference when only signatures changed', () => {
    // This is the behaviour the flicker depended on: one changed leaf used to
    // produce a new media object -> new card -> new array -> every card
    // remounted and every <img> reloaded.
    const previous = {
      items: [
        { id: 'c1', title: 'Resort', coverImage: signed(ISSUED_AT, 'aaa') },
        { id: 'c2', title: 'Bridal', coverImage: signed(ISSUED_AT, 'ccc') },
      ],
    };
    const next = {
      items: [
        { id: 'c1', title: 'Resort', coverImage: signed(RESIGNED_AT, 'bbb') },
        { id: 'c2', title: 'Bridal', coverImage: signed(RESIGNED_AT, 'ddd') },
      ],
    };

    const merged = replaceEqualDeepPreservingSignedUrls(previous, next);

    expect(merged).toBe(previous);
    expect(merged.items[0]).toBe(previous.items[0]);
  });

  it('still propagates a genuine change, and only where it happened', () => {
    const previous = {
      items: [
        { id: 'c1', title: 'Resort', coverImage: signed(ISSUED_AT, 'aaa') },
        { id: 'c2', title: 'Bridal', coverImage: signed(ISSUED_AT, 'ccc') },
      ],
    };
    const next = {
      items: [
        { id: 'c1', title: 'Resort 2026', coverImage: signed(RESIGNED_AT, 'bbb') },
        { id: 'c2', title: 'Bridal', coverImage: signed(RESIGNED_AT, 'ddd') },
      ],
    };

    const merged = replaceEqualDeepPreservingSignedUrls(previous, next);

    expect(merged).not.toBe(previous);
    expect(merged.items[0].title).toBe('Resort 2026');
    // The untouched sibling keeps its identity, so its card does not re-render.
    expect(merged.items[1]).toBe(previous.items[1]);
  });

  it('handles added and removed rows without merging by position', () => {
    const previous = { items: [{ id: 'c1' }, { id: 'c2' }] };
    const next = { items: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };

    const merged = replaceEqualDeepPreservingSignedUrls(previous, next);

    expect(merged.items).toHaveLength(3);
    expect(merged.items[0]).toBe(previous.items[0]);
    expect(merged.items[2]).toEqual({ id: 'c3' });
  });

  it('leaves non-URL values alone', () => {
    expect(replaceEqualDeepPreservingSignedUrls('a', 'b')).toBe('b');
    expect(replaceEqualDeepPreservingSignedUrls(1, 2)).toBe(2);
    expect(replaceEqualDeepPreservingSignedUrls(null, undefined)).toBe(undefined);
    expect(replaceEqualDeepPreservingSignedUrls({ a: 1 }, { a: 1 })).toEqual({ a: 1 });
  });

  it('does not treat a null prototype payload as a mismatch', () => {
    const previous = Object.assign(Object.create(null), { a: 1 });
    const next = Object.assign(Object.create(null), { a: 1 });
    expect(replaceEqualDeepPreservingSignedUrls(previous, next)).toBe(previous);
  });
});
