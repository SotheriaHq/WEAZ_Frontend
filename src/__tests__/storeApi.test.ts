import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patch } = vi.hoisted(() => ({
  patch: vi.fn(),
}));

vi.mock('../api/httpClient', () => ({
  apiClient: {
    patch,
  },
}));

vi.mock('../api/idempotency', () => ({
  createIdempotencyKey: () => 'idem-fixed-key',
}));

import { updateStorePaymentAccount } from '../api/StoreApi';

describe('updateStorePaymentAccount', () => {
  beforeEach(() => {
    patch.mockReset();
    patch.mockResolvedValue({ data: { data: { id: 'account_1' } } });
  });

  it('sends an idempotency key header', async () => {
    await updateStorePaymentAccount({ bankCode: '058' } as any);

    expect(patch).toHaveBeenCalledWith(
      '/store/payment-account',
      { bankCode: '058' },
      { headers: { 'Idempotency-Key': 'idem-fixed-key' } },
    );
  });
});