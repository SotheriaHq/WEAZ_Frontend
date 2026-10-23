import { describe, expect, it } from 'vitest';
import { getMediaUrlExpiryMs, getMediaUrlIdentity, isStorageProviderUrl, isUsableMediaUrl, mediaUrlCacheExpiresAt } from './mediaUrlPolicy';
const now = Date.UTC(2026, 9, 22, 12);
const r2 = 'https://account.r2.cloudflarestorage.com/private/key.jpg';
const sdk = `${r2}?X-Amz-Date=20261022T120000Z&X-Amz-Expires=300&X-Amz-Signature=abc`;
const gateway = (seconds: number) => `https://media.example.com/media/key.jpg?env=sit&method=GET&exp=${(now + seconds * 1000) / 1000}&sig=abc`;
describe('media URL capability policy', () => {
  it('parses R2 SDK expiry independently of an AWS hostname', () => {
    expect(getMediaUrlExpiryMs(sdk)).toBe(now + 300_000);
    expect(isUsableMediaUrl(sdk, now)).toBe(true);
    expect(isUsableMediaUrl(sdk, now + 300_000)).toBe(false);
  });
  it('parses gateway expiry and refuses stale restored capabilities', () => {
    expect(isUsableMediaUrl(gateway(300), now)).toBe(true);
    expect(isUsableMediaUrl(gateway(-1), now)).toBe(false);
    expect(isUsableMediaUrl(gateway(10), now)).toBe(false);
  });
  it('rejects unsigned storage origins without blocking legitimate external or local images', () => {
    expect(isUsableMediaUrl(r2, now)).toBe(false);
    expect(isUsableMediaUrl('https://bucket.r2.dev/key.jpg', now)).toBe(false);
    expect(isUsableMediaUrl('https://cdn.example.com/key.jpg', now)).toBe(true);
    expect(isUsableMediaUrl('file:///photo.jpg', now)).toBe(true);
    expect(isUsableMediaUrl('content://photo/1', now)).toBe(true);
  });
  it('uses exact provider hostname boundaries', () => {
    expect(isStorageProviderUrl('https://r2.cloudflarestorage.com.attacker.example/key')).toBe(false);
    expect(isStorageProviderUrl('https://amazonaws.com.attacker.example/key')).toBe(false);
    expect(isStorageProviderUrl(r2)).toBe(true);
  });
  it('rejects malformed explicit expiry and impossible SDK dates', () => {
    expect(isUsableMediaUrl('https://media.example/key?exp=oops&sig=abc', now)).toBe(false);
    expect(isUsableMediaUrl(sdk.replace('20261022', '20260231'), now)).toBe(false);
    expect(isUsableMediaUrl('https://cdn.example/key?token=opaque', now)).toBe(true);
  });
  it('preserves permission and transform identity while stripping all bearer material', () => {
    expect(getMediaUrlIdentity(`${gateway(300)}&width=400`)).toBe('https://media.example.com/media/key.jpg?env=sit&method=GET&width=400');
    expect(getMediaUrlIdentity(`${r2}?X-Amz-Credential=secret&X-Amz-Security-Token=secret&width=400`)).toBe(`${r2}?width=400`);
  });
  it('caps cache life at the capability expiry', () => {
    expect(mediaUrlCacheExpiresAt(gateway(300), 840_000, now)).toBe(now + 270_000);
  });
});
