import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/httpClient';
import {
  getNormalizedImageFile,
  prepareImageForUpload,
  uploadPreviewImage,
} from '@/api/UploadApi';
import { preprocessImageFile } from '@/utils/imagePreprocess';
import { WEB_UPLOAD_POLICIES } from '@/utils/uploadValidation';

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/utils/imagePreprocess', () => ({ preprocessImageFile: vi.fn() }));

const postMock = vi.mocked(apiClient.post);
const preprocessMock = vi.mocked(preprocessImageFile);

let objectUrlCounter = 0;

describe('UploadApi server normalization', () => {
  beforeEach(() => {
    postMock.mockClear();
    postMock.mockImplementation(async () => ({
      data: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
        type: 'image/jpeg',
      }),
    }));
    objectUrlCounter = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${objectUrlCounter++}`);
  });

  const makeFile = (name: string) =>
    new File([new Uint8Array(64)], name, {
      type: 'image/jpeg',
      lastModified: 1234567,
    });

  it('shares ONE server call between preview and upload for the same file', async () => {
    const file = makeFile('shared-photo.jpg');

    const [previewUrl, normalizedFile] = await Promise.all([
      uploadPreviewImage(file),
      getNormalizedImageFile(file),
    ]);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(previewUrl.startsWith('blob:')).toBe(true);
    expect(normalizedFile.type).toBe('image/jpeg');
    expect(normalizedFile.name).toBe('shared-photo.pre.jpg');
  });

  it('serves repeat requests for the same file from cache', async () => {
    const file = makeFile('cached-photo.jpg');
    await uploadPreviewImage(file);
    await uploadPreviewImage(file);
    await getNormalizedImageFile(file);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a server preview blob that is not JPEG bytes', async () => {
    postMock.mockImplementationOnce(async () => ({
      data: new Blob([new Uint8Array([0x7b, 0x22, 0x64])], {
        type: 'application/json',
      }),
    }));

    await expect(
      uploadPreviewImage(makeFile('json-envelope.jpg')),
    ).rejects.toThrow(/did not return JPEG bytes/i);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('requests distinct files separately with a dedicated timeout', async () => {
    await uploadPreviewImage(makeFile('one.jpg'));
    await uploadPreviewImage(makeFile('two.jpg'));
    expect(postMock).toHaveBeenCalledTimes(2);

    const [, , config] = postMock.mock.calls[0];
    expect(config).toMatchObject({ timeout: 90_000, responseType: 'blob' });
  });

  it('never collides files that share metadata but differ in content', async () => {
    // Android content:// picks can stamp identical name/size/lastModified on
    // DIFFERENT photos — the content fingerprint must keep them apart, or one
    // photo's bytes would silently serve as the other's preview and upload.
    const metadata = { type: 'image/jpeg', lastModified: 777 } as const;
    const photoA = new File(
      [new Uint8Array(64).fill(0x01)],
      'IMG.jpg',
      metadata,
    );
    const photoB = new File(
      [new Uint8Array(64).fill(0x02)],
      'IMG.jpg',
      metadata,
    );
    expect(photoA.size).toBe(photoB.size);

    await uploadPreviewImage(photoA);
    await uploadPreviewImage(photoB);
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('sends the canonical transcode profile as multipart fields', async () => {
    await uploadPreviewImage(makeFile('profiled.jpg'));
    const [, body] = postMock.mock.calls[0];
    const form = body as FormData;
    expect(form.get('maxWidth')).toBe('2048');
    expect(form.get('quality')).toBe('99');
    expect(form.get('maxBytes')).toBe(String(2 * 1024 * 1024));
    expect(form.get('targetBytes')).toBe(String(1024 * 1024));
  });
});

describe('prepareImageForUpload', () => {
  const policy = WEB_UPLOAD_POLICIES.bannerImage;
  const MB = 1024 * 1024;
  const sized = (name: string, type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], name, { type });

  beforeEach(() => {
    postMock.mockClear();
    preprocessMock.mockReset();
    postMock.mockImplementation(async () => ({
      data: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    }));
  });

  it('sends the compressed file without a server round trip', async () => {
    const compressed = sized('banner.pre.webp', 'image/webp', MB);
    const original = sized('banner.jpg', 'image/jpeg', 3 * MB);
    preprocessMock.mockResolvedValue({ file: compressed, originalFile: original, skipped: false });

    await expect(prepareImageForUpload(original, policy)).resolves.toBe(compressed);
    expect(preprocessMock).toHaveBeenCalledWith(original, {
      maxSizeBytes: 2 * MB,
      preferredSizeBytes: MB,
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('falls back to the server for a file this browser cannot decode', async () => {
    preprocessMock.mockRejectedValue(new Error('decode failed'));
    const heic = sized('camera-heic.jpg', 'image/jpeg', 3 * MB);

    const prepared = await prepareImageForUpload(heic, policy);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(prepared.name).toBe('camera-heic.pre.jpg');
  });

  it('leaves a GIF alone, since flattening it would lose the animation', async () => {
    const gif = sized('loop.gif', 'image/gif', 3 * MB);

    await expect(prepareImageForUpload(gif, policy)).resolves.toBe(gif);
    expect(preprocessMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('returns the original when nothing worked, so the size check can refuse it', async () => {
    preprocessMock.mockRejectedValue(new Error('decode failed'));
    postMock.mockRejectedValue(new Error('offline'));
    const photo = sized('failed.jpg', 'image/jpeg', 3 * MB);

    await expect(prepareImageForUpload(photo, policy)).resolves.toBe(photo);
  });
});
