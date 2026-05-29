import { describe, expect, it } from 'vitest';
import {
  WEB_UPLOAD_POLICIES,
  UploadValidationError,
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

  it('uses extension fallback when picker MIME metadata is missing', () => {
    const file = makeFile('look.jpg', '', 1024);

    expect(validateUploadFile(file, WEB_UPLOAD_POLICIES.designMedia)).toEqual([]);
  });
});
