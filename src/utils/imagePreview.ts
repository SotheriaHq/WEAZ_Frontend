const TRANSCODE_IMAGE_TYPES = new Set(['image/heic', 'image/heif', 'image/avif']);

/** Formats <img> renders natively everywhere — eligible for the raw data: URL fallback. */
const RAW_PREVIEW_DISPLAYABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

export const MAX_PREVIEW_SOURCE_BYTES = 32 * 1024 * 1024;
export const MAX_RAW_PREVIEW_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_PREVIEW_DIMENSION = 1600;
export const JPEG_PREVIEW_QUALITY = 0.82;
export const PREVIEW_STRATEGY_TIMEOUT_MS = 12_000;

/** Gray 64×64 JPEG used when every decode strategy fails (never use blob: on mobile). */
export const IMAGE_PREVIEW_UNAVAILABLE_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

export const isPreviewUnavailableDataUrl = (url?: string | null): boolean =>
  typeof url === 'string' && url === IMAGE_PREVIEW_UNAVAILABLE_DATA_URL;

export const isLikelyImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name);
};

export const prefersCanvasImagePreview = (): boolean => {
  if (typeof window === 'undefined') return true;

  const touchCapable =
    navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const matchMedia =
    typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : null;
  const coarsePointer = matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowViewport = matchMedia?.('(max-width: 1024px)').matches ?? false;

  return touchCapable && (coarsePointer || narrowViewport);
};

export const normalizeImageFile = (file: File): File => {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith('image/')) {
    return file;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const inferredType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : extension === 'gif'
          ? 'image/gif'
          : extension === 'heic' || extension === 'heif'
            ? 'image/heic'
            : 'image/jpeg';

  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
};

const scaleToFit = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } => {
  const longestEdge = Math.max(width, height, 1);
  if (longestEdge <= maxDimension) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const canvasToJpegCanvas = (
  source: CanvasImageSource,
  width: number,
  height: number,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context not available');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
};

const canvasToJpegBlobUrl = async (
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<string> => {
  const canvas = canvasToJpegCanvas(source, width, height);
  if (typeof canvas.toBlob !== 'function' || typeof URL.createObjectURL !== 'function') {
    return canvas.toDataURL('image/jpeg', JPEG_PREVIEW_QUALITY);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }
        reject(new Error('Canvas blob encoding failed'));
      },
      'image/jpeg',
      JPEG_PREVIEW_QUALITY,
    );
  });

  return URL.createObjectURL(blob);
};

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';

    const finish = async () => {
      try {
        if (typeof image.decode === 'function') {
          await image.decode();
        }
        resolve(image);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Preview decode failed'));
      }
    };

    image.onload = () => {
      void finish();
    };
    image.onerror = () => reject(new Error('Preview image decode failed'));
    image.src = src;
  });

const bitmapToJpegPreviewUrl = async (bitmap: ImageBitmap): Promise<string> => {
  try {
    const { width, height } = scaleToFit(
      bitmap.width,
      bitmap.height,
      MAX_PREVIEW_DIMENSION,
    );
    return await canvasToJpegBlobUrl(bitmap, width, height);
  } finally {
    bitmap.close();
  }
};

const withPreviewTimeout = async <T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs = PREVIEW_STRATEGY_TIMEOUT_MS,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const createBitmapFromFile = async (file: File): Promise<ImageBitmap> => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap unavailable');
  }

  // iOS Safari can hang on resize/orientation options for HEIC camera rolls.
  if (prefersCanvasImagePreview()) {
    return createImageBitmap(file);
  }

  const resizeWidth = MAX_PREVIEW_DIMENSION;

  try {
    return await createImageBitmap(file, {
      imageOrientation: 'from-image',
      resizeWidth,
      resizeQuality: 'high',
    });
  } catch {
    try {
      return await createImageBitmap(file, { resizeWidth, resizeQuality: 'high' });
    } catch {
      return await createImageBitmap(file);
    }
  }
};

const buildPreviewViaImageBitmap = async (file: File): Promise<string> => {
  const bitmap = await createBitmapFromFile(file);
  return bitmapToJpegPreviewUrl(bitmap);
};

const buildPreviewViaBlobCanvas = async (file: File): Promise<string> => {
  const blobUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(blobUrl);
    const { width, height } = scaleToFit(
      image.naturalWidth,
      image.naturalHeight,
      MAX_PREVIEW_DIMENSION,
    );
    return canvasToJpegBlobUrl(image, width, height);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Preview read failed'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Preview read failed'));
    reader.readAsDataURL(file);
  });

const buildPreviewViaDataUrlCanvas = async (file: File): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);

  const image = await loadImageElement(dataUrl);
  const { width, height } = scaleToFit(
    image.naturalWidth,
    image.naturalHeight,
    MAX_PREVIEW_DIMENSION,
  );
  return canvasToJpegBlobUrl(image, width, height);
};

const shouldForceCanvasOutput = (file: File): boolean => {
  if (prefersCanvasImagePreview()) return true;
  const mime = file.type.trim().toLowerCase();
  if (!mime || TRANSCODE_IMAGE_TYPES.has(mime)) return true;
  return file.size > 2 * 1024 * 1024;
};

/**
 * Builds a browser-displayable preview URL for local image files.
 * Prefer a small blob: JPEG preview so Android does not have to render the
 * original camera file or a large inline base64 string.
 */
export const buildDisplayableImagePreview = async (
  file: File,
): Promise<string> => {
  const normalizedFile = normalizeImageFile(file);

  if (!isLikelyImageFile(normalizedFile)) {
    throw new Error('Unsupported preview file type');
  }
  if (normalizedFile.size > MAX_PREVIEW_SOURCE_BYTES) {
    throw new Error('Image is too large to preview locally');
  }

  const mobileFirst = prefersCanvasImagePreview();
  const mime = normalizedFile.type.trim().toLowerCase();
  const isHeicLike =
    TRANSCODE_IMAGE_TYPES.has(mime) ||
    /\.(heic|heif)$/i.test(normalizedFile.name);

  const bitmapStrategy = {
    label: 'bitmap',
    run: buildPreviewViaImageBitmap,
  };
  const blobStrategy = {
    label: 'blob-canvas',
    run: buildPreviewViaBlobCanvas,
  };
  const dataUrlStrategy = {
    label: 'dataurl-canvas',
    run: buildPreviewViaDataUrlCanvas,
  };

  const strategies: Array<{ label: string; run: (file: File) => Promise<string> }> =
    mobileFirst
      ? isHeicLike
        ? [bitmapStrategy, dataUrlStrategy, blobStrategy]
        : [blobStrategy, bitmapStrategy, dataUrlStrategy]
      : [bitmapStrategy, blobStrategy, dataUrlStrategy];

  let lastError: unknown;
  for (const strategy of strategies) {
    try {
      const previewUrl = await withPreviewTimeout(strategy.label, () =>
        strategy.run(normalizedFile),
      );
      if (previewUrl.startsWith('blob:') || previewUrl.startsWith('data:image/jpeg')) {
        return previewUrl;
      }
    } catch (error) {
      lastError = error;
    }
  }

  // Every strategy above requires canvas READBACK (toDataURL), which privacy
  // browsers (Brave shields, fingerprint protection) can block wholesale — a
  // plain JPEG then fails all three. Formats <img> renders natively fall back
  // to the raw file bytes as a data: URL: no canvas involved, works anywhere.
  if (
    RAW_PREVIEW_DISPLAYABLE_TYPES.has(mime) &&
    normalizedFile.size <= MAX_RAW_PREVIEW_SOURCE_BYTES
  ) {
    try {
      const rawDataUrl = await withPreviewTimeout('raw-dataurl', () =>
        readFileAsDataUrl(normalizedFile),
      );
      if (rawDataUrl.startsWith('data:image/')) {
        console.warn(
          '[imagePreview] canvas strategies failed; using raw data URL preview',
          lastError,
        );
        return rawDataUrl;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (shouldForceCanvasOutput(normalizedFile)) {
    console.warn('[imagePreview] All strategies failed; using placeholder', lastError);
    return IMAGE_PREVIEW_UNAVAILABLE_DATA_URL;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to build image preview');
};

/** Returns true when an <img> can decode the URL on this device. */
export const probeImagePreviewUrl = (
  src: string,
  timeoutMs = 5_000,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Image probe timed out'));
    }, timeoutMs);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback();
    };

    image.onload = () => {
      finish(() => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          resolve();
        } else {
          reject(new Error('Image decoded with empty dimensions'));
        }
      });
    };
    image.onerror = () => {
      finish(() => reject(new Error('Image probe failed')));
    };
    image.src = src;
  });

export const buildVideoPreviewUrl = (file: File): string =>
  URL.createObjectURL(file);

export const revokeObjectPreviewUrl = (url?: string | null): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};
