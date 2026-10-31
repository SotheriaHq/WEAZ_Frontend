import { describe, expect, it } from 'vitest';
import {
  WEB_UPLOAD_POLICIES,
  UploadValidationError,
  assertSupportedUploadType,
  assertValidUploadFile,
  assertValidUploadFiles,
  validateUploadFile,
  validateUploadFiles,
} from './uploadValidation';

const makeFile = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe('uploadValidation', () => {
  it('rejects oversized files before upload', () => {
    const file = makeFile('avatar.png', 'image/png', WEB_UPLOAD_POLICIES.profileImage.maxSizeBytes + 1);

    expect(validateUploadFile(file, WEB_UPLOAD_POLICIES.profileImage)).toContain(
      'Profile photo must be 2 MB or smaller.',
    );
  });

  // These mirror `upload.maxSize.*` on the live server. They once mirrored its
  // larger hard limits, so a 3MB photo skipped compression and was then refused.
  it('holds every image kind to the limit the API enforces', () => {
    const MB = 1024 * 1024;
    const { productMedia, ...twoMegabyteKinds } = WEB_UPLOAD_POLICIES;
    const images = Object.values(twoMegabyteKinds).filter((policy) =>
      policy.allowedMimeTypes.some((type) => type.startsWith('image/')),
    );

    expect(images).toHaveLength(6);
    for (const policy of images) {
      expect(policy.maxSizeBytes).toBe(2 * MB);
      expect(policy).toHaveProperty('preferredSizeBytes', MB);
    }
    expect(productMedia.maxSizeBytes).toBe(8 * MB);
    expect(productMedia.preferredSizeBytes).toBe(MB);
  });

  it('checks only the type when a file is chosen, because compression has not run yet', () => {
    const photo = makeFile('photo.jpg', 'image/jpeg', 3 * 1024 * 1024);
    const vector = makeFile('avatar.svg', 'image/svg+xml', 1024);

    expect(() => assertSupportedUploadType(photo, WEB_UPLOAD_POLICIES.profileImage)).not.toThrow();
    expect(() => assertValidUploadFile(photo, WEB_UPLOAD_POLICIES.profileImage)).toThrow(
      UploadValidationError,
    );
    expect(() => assertSupportedUploadType(vector, WEB_UPLOAD_POLICIES.profileImage)).toThrow(
      UploadValidationError,
    );
  });

  it('rejects unsupported MIME types before upload', () => {
    const file = makeFile('avatar.svg', 'image/svg+xml', 1024);

    expect(() => assertValidUploadFile(file, WEB_UPLOAD_POLICIES.profileImage)).toThrow(
      UploadValidationError,
    );
  });

  it('enforces max file count', () => {
    const files = [
      makeFile('one.jpg', 'image/jpeg', 1024),
      makeFile('two.jpg', 'image/jpeg', 1024),
    ];

    expect(
      validateUploadFiles(files, WEB_UPLOAD_POLICIES.profileImage),
    ).toContain('You can upload up to 1 profile photo files.');
  });

  it('allows valid files to proceed', () => {
    const file = makeFile('photo.webp', 'image/webp', 1024);

    expect(validateUploadFile(file, WEB_UPLOAD_POLICIES.productMedia)).toEqual([]);
    expect(() => assertValidUploadFiles([file], WEB_UPLOAD_POLICIES.productMedia)).not.toThrow();
  });

  // AVIF is rejected by every server FileType (see upload-policy.ts), so the
  // client must reject it here rather than at multer, where the upload UI has
  // no way to explain what happened. This test used to assert the opposite.
  it('rejects AVIF images, which no upload endpoint accepts', () => {
    const file = makeFile('look.avif', 'image/avif', 1024);

    expect(validateUploadFile(file, WEB_UPLOAD_POLICIES.designMedia)).not.toEqual([]);
  });

  it('uses extension fallback when picker MIME metadata is missing', () => {
    const file = makeFile('look.jpg', '', 1024);

    expect(validateUploadFile(file, WEB_UPLOAD_POLICIES.designMedia)).toEqual([]);
  });
});
