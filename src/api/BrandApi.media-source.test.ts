import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandApi } from './BrandApi';
import { apiClient } from './httpClient';
vi.mock('./httpClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const client = vi.mocked(apiClient);
describe('source renewal batching', () => {
 beforeEach(() => { vi.clearAllMocks(); brandApi.invalidateSignedUrlCache(); });
 it('renews 120 exact variants in 3 bounded batches without leaking credentials', async () => {
  client.post.mockImplementation(async (_path, body: any) => ({ data: { items: body.urls.map((source: string) => ({ source, url: `${source}&exp=${Math.floor(Date.now()/1000)+300}&sig=fresh` })) } }));
  const urls = Array.from({ length: 120 }, (_, index) => `https://media.example.com/media/variant-${index}.webp?env=sit&method=GET&exp=1&sig=secret`);
  const results = await Promise.all(urls.map((url) => brandApi.getSignedMediaSourceUrl(url, { allowSignedFallback: false, forceRefresh: true })));
  expect(results.every(Boolean)).toBe(true); expect(client.post).toHaveBeenCalledTimes(3);
  for (const [path, body] of client.post.mock.calls) {
   expect(path).toBe('/uploads/public-urls-by-source');
   expect((body as any).urls.length).toBeLessThanOrEqual(50);
   expect(JSON.stringify(body)).not.toContain('secret'); expect(JSON.stringify(body)).not.toContain('exp=');
  }
  expect(client.get).not.toHaveBeenCalled();
 });
 it('does not multiply traffic through GET fallback on throttling', async () => {
  client.post.mockRejectedValue({ response: { status: 429 } });
  expect(await brandApi.getSignedMediaSourceUrl('https://media.example/key?exp=1&sig=old', { allowSignedFallback: false })).toBeNull();
  expect(client.get).not.toHaveBeenCalled();
 });
 it('fences a delayed private response when the account changes', async () => {
  let release!: (value: any) => void;
  client.post.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const pending = brandApi.getSignedMediaSourceUrl('https://media.example/private?sig=old&exp=1');
  await vi.waitFor(() => expect(client.post).toHaveBeenCalled());
  brandApi.invalidateSignedUrlCache();
  release({ data: { items: [{ source: 'https://media.example/private', url: 'https://media.example/private?token=old-account' }] } });
  expect(await pending).toBeNull();
 });
});

describe('R2-only raw object resolution', () => {
 beforeEach(() => { vi.clearAllMocks(); brandApi.invalidateSignedUrlCache(); });
 it('removes the R2 bucket path while retaining the exact object key', async () => {
  client.get.mockResolvedValue({ data: { url: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/wiez-sit-media/POST_IMAGE/owner/look.jpg?X-Amz-Signature=current' } });
  const result = await brandApi.getSignedS3Url('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/wiez-sit-media/POST_IMAGE/owner/look.jpg');
  expect(result).toContain('X-Amz-Signature=current');
  expect(client.get).toHaveBeenCalledWith('/uploads/public-url-by-key', { params: { key: 'POST_IMAGE/owner/look.jpg' } });
 });
 it.each(['https://bucket.s3.eu-north-1.amazonaws.com/look.jpg', 'https://old.cloudfront.net/look.jpg', 'not-an-object-url'])('does not repair or renew retired/malformed sources: %s', async url => {
  expect(await brandApi.getSignedS3Url(url)).toBeNull();
  expect(client.get).not.toHaveBeenCalled();
 });
});
