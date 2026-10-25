import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryUploadCompletion } from './uploadFinalizeRetry';

describe('upload completion recovery', () => {
  afterEach(() => vi.useRealTimers());
  it('retries a transient storage conflict and returns the committed response', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValueOnce({ response: { status: 409, data: { code: 'UPLOAD_FINALIZING' } } })
      .mockResolvedValueOnce({ id: 'committed-file' });
    const pending = retryUploadCompletion(request);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ id: 'committed-file' });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each(['DRAFT_VERSION_CONFLICT', 'FORBIDDEN', undefined])('does not replay an unrelated conflict (%s)', async (code) => {
    const error = { response: { status: 409, data: { code } } };
    const request = vi.fn().mockRejectedValue(error);
    await expect(retryUploadCompletion(request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('bounds retries and preserves the final failure', async () => {
    vi.useFakeTimers();
    const error = { response: { status: 409, data: { code: 'UPLOAD_CHANGED' } } };
    const request = vi.fn().mockRejectedValue(error);
    const pending = retryUploadCompletion(request);
    const assertion = expect(pending).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('does not retry permission denial, cancellation, or network errors', async () => {
    for (const error of [{ response: { status: 403 } }, { code: 'ERR_CANCELED' }, new Error('Offline')]) {
      const request = vi.fn().mockRejectedValue(error);
      await expect(retryUploadCompletion(request)).rejects.toBe(error);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
