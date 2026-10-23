import { beforeEach, describe, expect, it } from 'vitest';
import { clearCachedMediaUrls, getCachedMediaUrl, resolveCachedMediaUrl } from './mediaUrlCache';
describe('authenticated media capability cache', () => {
 beforeEach(() => { clearCachedMediaUrls(); });
 it('coalesces forced renewal', async () => {
  let release!: (value: string) => void; let count = 0;
  const fetcher = () => { count++; return new Promise<string>((resolve) => { release = resolve; }); };
  const a = resolveCachedMediaUrl('key', fetcher, true);
  const b = resolveCachedMediaUrl('key', fetcher, true);
  release('https://cdn.example.com/photo');
  expect(await a).toBe(await b); expect(count).toBe(1);
 });
 it('discards an old-account response after session cleanup', async () => {
  let release!: (value: string) => void;
  const pending = resolveCachedMediaUrl('private', () => new Promise<string>((resolve) => { release = resolve; }));
  clearCachedMediaUrls(); release('https://cdn.example.com/private?token=old');
  expect(await pending).toBeNull(); expect(getCachedMediaUrl('private')).toBeNull();
 });
 it('never caches an unsigned origin or expired response', async () => {
  expect(await resolveCachedMediaUrl('private', async () => 'https://account.r2.cloudflarestorage.com/b/key')).toBeNull();
  expect(await resolveCachedMediaUrl('old', async () => 'https://media.example/key?exp=1&sig=old')).toBeNull();
 });
 it('recovers from malformed stored cache shape', async () => {
  sessionStorage.setItem('wiez_signed_url_cache', 'null');
  expect(await resolveCachedMediaUrl('key', async () => 'https://cdn.example.com/photo')).toBe('https://cdn.example.com/photo');
 });
});
