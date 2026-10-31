import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaProvider, useMediaStore } from './useMediaStore';

const mocks = vi.hoisted(() => ({
  sniff: vi.fn(), probe: vi.fn(), normalize: vi.fn(), build: vi.fn(), revoke: vi.fn(),
}));
vi.mock('@/utils/imageByteSniff', () => ({
  sniffImageFormat: mocks.sniff,
  isBrowserDisplayableSniff: (kind: string) => kind === 'jpeg',
  isUnreadableSniff: (kind: string) => kind === 'unreadable',
}));
vi.mock('@/utils/imagePreview', () => ({
  buildDisplayableImagePreview: mocks.build,
  buildVideoPreviewUrl: (file: File) => URL.createObjectURL(file),
  IMAGE_PREVIEW_UNAVAILABLE_DATA_URL: 'data:image/unavailable',
  isPreviewUnavailableDataUrl: (url: string) => url === 'data:image/unavailable',
  PREVIEW_STRATEGY_TIMEOUT_MS: 500,
  probeImagePreviewUrl: mocks.probe,
  revokeObjectPreviewUrl: mocks.revoke,
}));
vi.mock('@/api/UploadApi', () => ({ getNormalizedImageFile: mocks.normalize }));
vi.mock('@/utils/clientDiagnostics', () => ({ addClientDiagnostic: vi.fn() }));

let store: ReturnType<typeof useMediaStore>;
function Probe() { store = useMediaStore(); return <span>{store.items.length}</span>; }
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('local media preview pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let id = 0;
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL() { return `blob:local-${++id}`; }
      static revokeObjectURL = mocks.revoke;
    });
    mocks.sniff.mockResolvedValue('jpeg');
    mocks.probe.mockResolvedValue(undefined);
    mocks.build.mockResolvedValue('blob:canvas-preview');
    mocks.normalize.mockResolvedValue(new File(['normalized'], 'preview.jpg', { type: 'image/jpeg' }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows a large JPEG locally and keeps its source without any server conversion', async () => {
    const file = new File([new Uint8Array(3 * 1024 * 1024)], '13068.jpg', { type: 'image/jpeg' });
    render(<MediaProvider><Probe /></MediaProvider>);
    act(() => store.addFiles([file]));
    expect(store.items[0].previewUrl).toBe('blob:local-1');
    await waitFor(() => expect(mocks.probe).toHaveBeenCalled());
    expect(mocks.normalize).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
    expect(store.items[0].file).toBe(file);
  });

  it('does not replace a JPEG master when a server preview fallback is necessary', async () => {
    mocks.probe.mockRejectedValue(new Error('Cannot decode locally'));
    mocks.build.mockRejectedValue(new Error('Canvas unavailable'));
    const file = new File(['source'], 'source.jpg', { type: 'image/jpeg' });
    const view = render(<MediaProvider><Probe /></MediaProvider>);
    act(() => store.addFiles([file]));
    await waitFor(() => expect(store.items[0].previewUrl).toBe('blob:local-2'));
    expect(store.items[0].file).toBe(file);
    expect(mocks.normalize).toHaveBeenCalledOnce();
    expect(mocks.revoke).toHaveBeenCalledWith('blob:local-1');
    view.unmount();
    expect(mocks.revoke).toHaveBeenCalledWith('blob:local-2');
  });

  it('discards late normalization after removal without recreating the item or leaking a URL', async () => {
    mocks.sniff.mockResolvedValue('heic');
    const pending = deferred<File>();
    mocks.normalize.mockReturnValue(pending.promise);
    render(<MediaProvider><Probe /></MediaProvider>);
    act(() => store.addFiles([new File(['source'], 'source.heic', { type: 'image/heic' })]));
    await waitFor(() => expect(mocks.normalize).toHaveBeenCalledOnce());
    act(() => store.remove(store.items[0].id));
    await act(async () => pending.resolve(new File(['result'], 'preview.jpg', { type: 'image/jpeg' })));
    expect(store.items).toHaveLength(0);
    expect(mocks.revoke).toHaveBeenCalledWith('blob:local-1');
  });
});
