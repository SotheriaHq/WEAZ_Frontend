const DISPLAYABLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const TRANSCODE_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);

export const MAX_PREVIEW_SOURCE_BYTES = 24 * 1024 * 1024;
export const MAX_PREVIEW_DIMENSION = 2048;

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
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

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Preview image decode failed'));
    image.src = src;
  });

const scaleToFit = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } => {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const canvasToJpegDataUrl = (
  source: CanvasImageSource,
  width: number,
  height: number,
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context not available');
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.88);
};

export const isLikelyImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name);
};

export const shouldTranscodeImagePreview = (file: File): boolean => {
  const mime = file.type.trim().toLowerCase();
  if (!mime) return true;
  if (TRANSCODE_IMAGE_TYPES.has(mime)) return true;
  if (DISPLAYABLE_IMAGE_TYPES.has(mime)) return false;
  return mime.startsWith('image/');
};

const buildPreviewViaImageBitmap = async (file: File): Promise<string> => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap unavailable');
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const { width, height } = scaleToFit(
      bitmap.width,
      bitmap.height,
      MAX_PREVIEW_DIMENSION,
    );
    return canvasToJpegDataUrl(bitmap, width, height);
  } finally {
    bitmap.close();
  }
};

const buildPreviewViaImageElement = async (file: File): Promise<string> => {
  const dataUrl = await readFileAsDataURL(file);
  const image = await loadImageElement(dataUrl);
  const { width, height } = scaleToFit(
    image.naturalWidth,
    image.naturalHeight,
    MAX_PREVIEW_DIMENSION,
  );
  return canvasToJpegDataUrl(image, width, height);
};

/**
 * Builds a browser-displayable inline preview for local image files.
 * Mobile browsers often fail to render blob: URLs and cannot display HEIC in <img>.
 */
export const buildDisplayableImagePreview = async (
  file: File,
): Promise<string> => {
  if (!isLikelyImageFile(file)) {
    throw new Error('Unsupported preview file type');
  }
  if (file.size > MAX_PREVIEW_SOURCE_BYTES) {
    throw new Error('Image is too large to preview locally');
  }

  const requiresTranscode = shouldTranscodeImagePreview(file);

  if (requiresTranscode) {
    try {
      return await buildPreviewViaImageBitmap(file);
    } catch {
      return buildPreviewViaImageElement(file);
    }
  }

  if (file.size <= 4 * 1024 * 1024) {
    try {
      const dataUrl = await readFileAsDataURL(file);
      await loadImageElement(dataUrl);
      return dataUrl;
    } catch {
      // Fall through to transcoding for odd mobile payloads.
    }
  }

  try {
    return await buildPreviewViaImageBitmap(file);
  } catch {
    return buildPreviewViaImageElement(file);
  }
};

export const buildVideoPreviewUrl = (file: File): string =>
  URL.createObjectURL(file);

export const revokeObjectPreviewUrl = (url?: string | null): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};