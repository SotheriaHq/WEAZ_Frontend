import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoreGeneralSettings, getStorePolicies } from './StoreApi';
const get = vi.hoisted(() => vi.fn());
vi.mock('./httpClient', () => ({ apiClient: { get }, getStoredAccessToken: () => null }));
beforeEach(() => vi.clearAllMocks());
describe.each([
  ['general', '/store/settings/general', getStoreGeneralSettings],
  ['policies', '/store/policies', getStorePolicies],
] as const)('scoped store %s reads', (_name, endpoint, read) => {
  it('forwards cancellation and accepts only the requested workspace', async () => {
    const controller = new AbortController(); get.mockResolvedValue({ data: { data: { brandId: 'brand-a' } } });
    await expect(read({ signal: controller.signal, expectedBrandId: 'brand-a' })).resolves.toEqual({ brandId: 'brand-a' });
    expect(get).toHaveBeenCalledWith(endpoint, { signal: controller.signal });
  });
  it.each(['brand-b', undefined])('rejects foreign/missing brand witness: %s', async (brandId) => {
    get.mockResolvedValue({ data: { data: { brandId } } });
    await expect(read({ expectedBrandId: 'brand-a' })).rejects.toThrow('different workspace');
  });
});
