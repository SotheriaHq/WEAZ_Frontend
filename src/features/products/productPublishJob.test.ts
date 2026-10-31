import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productApi } from '@/api/ProductApi';
import { createPublishTask, readPublishTasks } from '@/utils/publishTracker';
import { resumeInterruptedProductLaunch } from './productPublishJob';

vi.mock('@/api/ProductApi', () => ({ productApi: { submitProductForReview: vi.fn() } }));
vi.mock('@/api/CustomOrderApi', () => ({ customOrderConfigurationsApi: {} }));
vi.mock('@/api/StoreApi', () => ({ updateStorePolicies: vi.fn() }));
vi.mock('@/utils/clientDiagnostics', () => ({ addClientDiagnostic: vi.fn() }));
vi.mock('@/utils/productStudioEvents', () => ({ emitProductStudioSync: vi.fn() }));

const scope = { ownerId: 'owner-1' };
const task = () => createPublishTask({ title: 'The Checks', ownerId: 'owner-1', entity: 'product' });
const stored = (id: string) => readPublishTasks(scope, 'product').find((entry) => entry.id === id);

describe('resumeInterruptedProductLaunch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('sends a product cut off by a reload to the reviewers', async () => {
    vi.mocked(productApi.submitProductForReview).mockResolvedValue({} as never);
    const { id } = task();
    await expect(resumeInterruptedProductLaunch(id, 'product-1', scope)).resolves.toBeNull();
    expect(productApi.submitProductForReview).toHaveBeenCalledWith('product-1');
    expect(stored(id)?.status).toBe('published');
  });

  it("shows the server's reason instead of failing silently", async () => {
    vi.mocked(productApi.submitProductForReview).mockRejectedValue({
      response: { data: { message: 'Front, Back, Left, and Right media are required.' } },
    });
    const { id } = task();
    await expect(resumeInterruptedProductLaunch(id, 'product-1', scope)).resolves.toBe(
      'Front, Back, Left, and Right media are required.',
    );
    expect(stored(id)?.status).toBe('failed');
    expect(stored(id)?.message).toContain('media are required');
  });
});
