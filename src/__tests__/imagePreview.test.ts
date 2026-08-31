import { describe, expect, it, vi } from 'vitest';
import {
  buildDisplayableImagePreview,
  IMAGE_PREVIEW_UNAVAILABLE_DATA_URL,
  isLikelyImageFile,
  isTrustedUpstreamImagePreview,
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

  it('trusts blob and probed data URLs from upstream preview producers', () => {
    expect(isTrustedUpstreamImagePreview('blob:abc-123')).toBe(true);
    expect(isTrustedUpstreamImagePreview('data:image/jpeg;base64,/9j/abc')).toBe(
      true,
    );
    expect(isTrustedUpstreamImagePreview(IMAGE_PREVIEW_UNAVAILABLE_DATA_URL)).toBe(
      false,
    );
    expect(isTrustedUpstreamImagePreview('')).toBe(false);
    expect(isTrustedUpstreamImagePreview('https://cdn.example.com/a.jpg')).toBe(
      false,
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

  /*
    A windowed touchscreen laptop: touch capable, viewport under 1024px, but a
    MOUSE — so the primary pointer is fine, not coarse.

    This must stay false. It is the switch that sends `useMediaStore` down the
    proactive branch, where every picked image at or above 1MB is uploaded to
    the server and transcoded before its preview settles. Classifying a desktop
    as mobile here costs a full-file round trip per image, on the 15s client
    default, to rebuild a thumbnail the browser already made locally.
  */
  it('does not prefer canvas output on a windowed touchscreen laptop (fine pointer)', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('max-width: 1024px'), // narrow, but pointer is fine
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
      value: 10,
    });

    expect(prefersCanvasImagePreview()).toBe(false);
    window.matchMedia = originalMatchMedia;
  });

  it('falls back to the raw data: URL when every canvas strategy fails (privacy browsers)', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal('createImageBitmap', () =>
      Promise.reject(new Error('canvas blocked')),
    );
    // Image that never decodes — simulates canvas/fingerprint-blocked browsers.
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decoding = '';
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage);

    try {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
      const file = new File([bytes], 'photo.jpg', { type: 'image/jpeg' });
      const url = await buildDisplayableImagePreview(file);
      expect(url.startsWith('data:image/jpeg')).toBe(true);
      expect(url).not.toBe(IMAGE_PREVIEW_UNAVAILABLE_DATA_URL);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.unstubAllGlobals();
    }
  });
});