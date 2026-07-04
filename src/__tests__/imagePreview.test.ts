import { describe, expect, it } from 'vitest';
import {
  IMAGE_PREVIEW_UNAVAILABLE_DATA_URL,
  isLikelyImageFile,
  normalizeImageFile,
  prefersCanvasImagePreview,
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

  it('infers mime type for mobile files with empty type', () => {
    const normalized = normalizeImageFile(
      new File(['a'], 'photo.heic', { type: '' }),
    );
    expect(normalized.type).toBe('image/heic');
  });

  it('exposes a safe placeholder preview data url', () => {
    expect(IMAGE_PREVIEW_UNAVAILABLE_DATA_URL.startsWith('data:image/jpeg')).toBe(
      true,
    );
  });

  it('prefers canvas output on touch-capable narrow viewports', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches:
          query.includes('pointer: coarse') || query.includes('max-width: 1024px'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      value: 5,
    });

    expect(prefersCanvasImagePreview()).toBe(true);
    window.matchMedia = originalMatchMedia;
  });
});