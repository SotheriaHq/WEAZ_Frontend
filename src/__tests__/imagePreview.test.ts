import { describe, expect, it } from 'vitest';
import {
  isLikelyImageFile,
  shouldTranscodeImagePreview,
} from '@/utils/imagePreview';

describe('imagePreview', () => {
  it('detects common mobile gallery image files', () => {
    expect(
      isLikelyImageFile(new File(['a'], 'photo.heic', { type: 'image/heic' })),
    ).toBe(true);
    expect(
      isLikelyImageFile(new File(['a'], 'photo.jpg', { type: '' })),
    ).toBe(true);
  });

  it('requires transcoding for HEIC and unknown mobile image payloads', () => {
    expect(
      shouldTranscodeImagePreview(
        new File(['a'], 'photo.heic', { type: 'image/heic' }),
      ),
    ).toBe(true);
    expect(
      shouldTranscodeImagePreview(
        new File(['a'], 'photo.jpg', { type: '' }),
      ),
    ).toBe(true);
    expect(
      shouldTranscodeImagePreview(
        new File(['a'], 'photo.jpg', { type: 'image/jpeg' }),
      ),
    ).toBe(false);
  });
});