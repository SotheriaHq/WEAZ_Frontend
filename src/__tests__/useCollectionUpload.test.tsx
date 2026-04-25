import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollectionUpload } from '../hooks/useCollectionUpload';
import type { MediaItem } from '../types/media';
import { initializeCollectionUploads, finalizeCollectionUploads } from '../api/collectionUploads';

vi.mock('../api/collectionUploads', () => ({
  initializeCollectionUploads: vi.fn(),
  finalizeCollectionUploads: vi.fn(),
}));

const initializeCollectionUploadsMock = vi.mocked(initializeCollectionUploads);
const finalizeCollectionUploadsMock = vi.mocked(finalizeCollectionUploads);

const flushPromises = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    await Promise.resolve();
  }
};

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  upload = {
    onprogress: null as ((event: ProgressEvent) => void) | null,
  };

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  method?: string;
  url?: string;
  body: Document | XMLHttpRequestBodyInit | null = null;
  headers: Record<string, string> = {};

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(header: string, value: string) {
    this.headers[header] = value;
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.body = body ?? null;
  }

  static reset() {
    MockXMLHttpRequest.instances = [];
  }
}

describe('useCollectionUpload', () => {
beforeEach(() => {
  MockXMLHttpRequest.reset();
  (globalThis as unknown as { XMLHttpRequest: typeof MockXMLHttpRequest }).XMLHttpRequest = MockXMLHttpRequest;
  initializeCollectionUploadsMock.mockReset();
  finalizeCollectionUploadsMock.mockReset();
});

afterEach(() => {
  MockXMLHttpRequest.reset();
  vi.useRealTimers();
});

  it('uploads multiple files concurrently and tracks progress', async () => {
    initializeCollectionUploadsMock.mockResolvedValue({
      collectionId: 'collection-1',
      uploads: [
        { fileId: 'file-1', expectedKey: 'key-1', uploadUrl: 'https://example.com/1', method: 'PUT' },
        { fileId: 'file-2', expectedKey: 'key-2', uploadUrl: 'https://example.com/2', method: 'PUT' },
      ],
    });
    finalizeCollectionUploadsMock.mockResolvedValue({ ok: true });

    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });
    const items: MediaItem[] = [
      { id: 'file-1', file: fileA, previewUrl: 'blob:a', kind: 'image' },
      { id: 'file-2', file: fileB, previewUrl: 'blob:b', kind: 'image' },
    ];

    const { result } = renderHook(() => useCollectionUpload());

    let uploadPromise: Promise<unknown> | undefined;
    await act(async () => {
      uploadPromise = result.current.uploadCollection(items, 'New Collection', 'Desc', undefined, undefined, false, ['evening']);
      await flushPromises();
    });

    expect(initializeCollectionUploadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Collection',
        tags: ['evening'],
      }),
    );

    expect(MockXMLHttpRequest.instances.length).toBe(2);
    const [requestA, requestB] = MockXMLHttpRequest.instances;

    act(() => {
      requestA.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
    });

    await waitFor(() => expect(result.current.perFileProgress['file-1']).toBe(50));
    await waitFor(() => expect(result.current.progress).toBe(25));

    act(() => {
      requestB.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 5 } as ProgressEvent);
    });

    await waitFor(() => expect(result.current.perFileProgress['file-2']).toBe(100));
    await waitFor(() => expect(result.current.progress).toBeGreaterThanOrEqual(75));

    act(() => {
      requestA.status = 200;
      requestB.status = 200;
      requestA.onload?.();
      requestB.onload?.();
    });

    expect(uploadPromise).toBeDefined();
    await act(async () => {
      await uploadPromise;
    });
    expect(result.current.progress).toBe(100);
    expect(result.current.perFileProgress).toEqual({});
    expect(finalizeCollectionUploadsMock).toHaveBeenCalledOnce();
    expect(finalizeCollectionUploadsMock).toHaveBeenCalledWith('collection-1', [
      expect.objectContaining({ fileId: 'file-1', s3Key: 'key-1', actualSize: fileA.size }),
      expect.objectContaining({ fileId: 'file-2', s3Key: 'key-2', actualSize: fileB.size }),
    ], true);
    expect(result.current.isUploading).toBe(false);
  });

  it('retries failed uploads before surfacing an error', async () => {
    vi.useFakeTimers();

    initializeCollectionUploadsMock.mockResolvedValue({
      collectionId: 'collection-retry',
      uploads: [{ fileId: 'retry-file', expectedKey: 'retry-key', uploadUrl: 'https://example.com/retry', method: 'PUT' }],
    });
    finalizeCollectionUploadsMock.mockResolvedValue({ ok: true });

    const retryFile = new File(['retry'], 'retry.png', { type: 'image/png' });
    const items: MediaItem[] = [{ id: 'retry-file', file: retryFile, previewUrl: 'blob:retry', kind: 'image' }];

    const { result } = renderHook(() => useCollectionUpload());

    let uploadPromise: Promise<unknown> | undefined;
    await act(async () => {
      uploadPromise = result.current.uploadCollection(items, 'Retry Collection', undefined, undefined, undefined, false, ['resort']);
      await flushPromises();
    });

    expect(initializeCollectionUploadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Retry Collection',
        tags: ['resort'],
      }),
    );

    expect(MockXMLHttpRequest.instances.length).toBe(1);
    const firstAttempt = MockXMLHttpRequest.instances[0];

    act(() => {
      firstAttempt.onerror?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    await act(async () => {
      await flushPromises(6);
    });

    expect(MockXMLHttpRequest.instances.length).toBe(2);
    const secondAttempt = MockXMLHttpRequest.instances[1];

    act(() => {
      secondAttempt.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 5 } as ProgressEvent);
      secondAttempt.status = 200;
      secondAttempt.onload?.();
    });

    expect(uploadPromise).toBeDefined();
    await act(async () => {
      await uploadPromise;
    });
    expect(result.current.progress).toBe(100);
    expect(finalizeCollectionUploadsMock).toHaveBeenCalledWith('collection-retry', [
      expect.objectContaining({ fileId: 'retry-file', s3Key: 'retry-key' }),
    ], true);
    expect(result.current.error).toBeNull();
    expect(result.current.perFileProgress).toEqual({});
    expect(result.current.isUploading).toBe(false);
  });
});
