import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productApi } from '@/api/ProductApi';
import { createPublishTask, readPublishTasks } from '@/utils/publishTracker';
import { resumeInterruptedProductLaunch, runProductPublishJob, getRetryableProductPublishJob,
  clearRetryableProductPublishJob } from './productPublishJob';

vi.mock('@/api/ProductApi', () => ({ productApi: { submitProductForReview: vi.fn(),
  createProduct: vi.fn(), uploadProductMedia: vi.fn(), updateProduct: vi.fn() } }));
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

describe('product draft save and interrupted media recovery', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetAllMocks();
  });

  function draftInput() {
    const { id } = createPublishTask({ title: 'Draft', ownerId: 'owner-1', entity: 'product', kind: 'draft' });
    return { taskId: id, ownerId: 'owner-1', title: 'Draft', finalStatus: 'DRAFT' as const,
      payload: { title: 'Draft', status: 'DRAFT' } as Parameters<typeof runProductPublishJob>[0]['payload'],
      pendingUploads: [
        { file: new File(['front'], 'front.jpg', { type: 'image/jpeg' }), isPrimary: true, viewSlot: 'FRONT' as const },
        { file: new File(['back'], 'back.jpg', { type: 'image/jpeg' }), isPrimary: false, viewSlot: 'BACK' as const },
      ],
    };
  }

  it('saves incomplete drafts without submitting them for review', async () => {
    const input = draftInput();
    vi.mocked(productApi.createProduct).mockResolvedValue({ id: 'draft-1' } as never);
    vi.mocked(productApi.uploadProductMedia).mockResolvedValue({ id: 'file-1' } as never);
    await runProductPublishJob(input);
    expect(productApi.createProduct).toHaveBeenCalledWith(input.payload);
    expect(productApi.updateProduct).not.toHaveBeenCalled();
    expect(productApi.submitProductForReview).not.toHaveBeenCalled();
    expect(stored(input.taskId)?.message).toBe('Draft saved');
  });

  it('retains the draft, photos and upload checkpoint after failure and resumes without duplicates', async () => {
    const input = draftInput();
    vi.mocked(productApi.createProduct).mockResolvedValue({ id: 'draft-1' } as never);
    vi.mocked(productApi.uploadProductMedia)
      .mockResolvedValueOnce({ id: 'front-id' } as never)
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'));
    await runProductPublishJob(input);
    expect(stored(input.taskId)?.status).toBe('failed');
    const retry = getRetryableProductPublishJob(input.taskId)!;
    expect(retry.existingProductId).toBe('draft-1');
    expect(retry.completedUploadIds).toEqual(['front-id']);
    expect(retry.pendingUploads[1].file).toBe(input.pendingUploads[1].file);
    vi.mocked(productApi.uploadProductMedia).mockResolvedValue({ id: 'back-id' } as never);
    await runProductPublishJob(retry);
    expect(productApi.createProduct).toHaveBeenCalledTimes(1);
    expect(productApi.uploadProductMedia).toHaveBeenCalledTimes(4);
    expect(productApi.uploadProductMedia).toHaveBeenLastCalledWith('draft-1', input.pendingUploads[1].file, false, 'BACK');
    expect(productApi.submitProductForReview).not.toHaveBeenCalled();
    expect(stored(input.taskId)?.message).toBe('Draft saved');
    expect(getRetryableProductPublishJob(input.taskId)).toBeUndefined();
    clearRetryableProductPublishJob(input.taskId);
  });

  it('retains media order when a publish retries after the draft uploads have completed', async () => {
    const input = { ...draftInput(), finalStatus: 'ACTIVE' as const };
    vi.mocked(productApi.createProduct).mockResolvedValue({ id: 'draft-1' } as never);
    vi.mocked(productApi.uploadProductMedia).mockResolvedValueOnce({ id: 'front-id' } as never)
      .mockResolvedValueOnce({ id: 'back-id' } as never);
    vi.mocked(productApi.updateProduct).mockRejectedValueOnce(new Error('offline'));
    await runProductPublishJob(input);
    const retry = getRetryableProductPublishJob(input.taskId)!;
    vi.mocked(productApi.updateProduct).mockResolvedValue({ id: 'draft-1' } as never);
    await runProductPublishJob(retry);
    expect(productApi.createProduct).toHaveBeenCalledTimes(1);
    expect(productApi.uploadProductMedia).toHaveBeenCalledTimes(2);
    expect(productApi.updateProduct).toHaveBeenLastCalledWith('draft-1', expect.objectContaining({
      status: 'ACTIVE', media: [
        { fileUploadId: 'front-id', viewSlot: 'FRONT', orderIndex: 0 },
        { fileUploadId: 'back-id', viewSlot: 'BACK', orderIndex: 1 },
      ],
    }));
  });
});
