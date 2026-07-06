export type ImagePreprocessProfile = 'avatar' | 'banner' | 'card' | 'detail';

export interface ImagePreprocessResult {
  file: File;
  originalFile: File;
  skipped: boolean;
  reason?: string;
}

export interface ImagePreprocessOptions {
  maxSizeBytes?: number;
  quality?: number;
  minQuality?: number;
}

const profileMaxWidth: Record<ImagePreprocessProfile, number> = {
  avatar: 512,
  banner: 1920,
  card: 1280,
  detail: 2048,
};

const MAX_INPUT_PIXELS = 50_000_000;
const MIN_OUTPUT_WIDTH = 720;
const DEFAULT_JPEG_QUALITY = 0.86;
const DEFAULT_MIN_JPEG_QUALITY = 0.58;
const MAX_SIZE_ATTEMPTS = 8;

const isGifFile = (file: File) =>
  file.type.trim().toLowerCase() === 'image/gif' || /\.gif$/i.test(file.name);

const inferImageType = (file: File) => {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith('image/')) return type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  if (extension === 'avif') return 'image/avif';
  return '';
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), type, quality);
  });

const buildPreprocessedName = (name: string, outputType: string) => {
  const ext = outputType === 'image/png' ? 'png' : 'jpg';
  return name.replace(/\.[^.]+$/, '') + `.pre.${ext}`;
};

export async function preprocessImageFile(
  file: File,
  profile: ImagePreprocessProfile,
  options: ImagePreprocessOptions = {},
): Promise<ImagePreprocessResult> {
  const inferredType = inferImageType(file);
  if (!inferredType) {
    return { file, originalFile: file, skipped: true, reason: 'not-image' };
  }

  const workingFile =
    file.type.trim().toLowerCase() === inferredType
      ? file
      : new File([file], file.name, {
          type: inferredType,
          lastModified: file.lastModified,
        });

  if (isGifFile(workingFile)) {
    return { file, originalFile: file, skipped: true, reason: 'gif-preserved' };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { file, originalFile: file, skipped: true, reason: 'no-dom' };
  }

  const bitmap = await createImageBitmap(workingFile);
  try {
    const pixels = bitmap.width * bitmap.height;
    if (pixels > MAX_INPUT_PIXELS) {
      throw new Error('Image dimensions are too large. Choose a smaller image.');
    }

    const targetWidth = Math.min(bitmap.width, profileMaxWidth[profile]);
    const needsResize = targetWidth < bitmap.width;
    const needsSizeReduction =
      typeof options.maxSizeBytes === 'number' &&
      workingFile.size > options.maxSizeBytes;

    if (!needsResize && !needsSizeReduction) {
      return { file, originalFile: file, skipped: true, reason: 'already-optimal' };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, originalFile: file, skipped: true, reason: 'context-unavailable' };
    }

    const outputType =
      needsSizeReduction || workingFile.type !== 'image/png' ? 'image/jpeg' : 'image/png';
    const minQuality = Math.max(
      0.35,
      Math.min(options.minQuality ?? DEFAULT_MIN_JPEG_QUALITY, DEFAULT_JPEG_QUALITY),
    );
    let quality = Math.max(
      minQuality,
      Math.min(options.quality ?? DEFAULT_JPEG_QUALITY, DEFAULT_JPEG_QUALITY),
    );
    let currentWidth = targetWidth;
    let currentHeight = Math.max(
      1,
      Math.round(bitmap.height * (currentWidth / bitmap.width)),
    );
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < MAX_SIZE_ATTEMPTS; attempt += 1) {
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.clearRect(0, 0, currentWidth, currentHeight);
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, currentWidth, currentHeight);
      }
      ctx.drawImage(bitmap, 0, 0, currentWidth, currentHeight);

      blob = await canvasToBlob(
        canvas,
        outputType,
        outputType === 'image/jpeg' ? quality : undefined,
      );

      if (!blob) break;
      if (!options.maxSizeBytes || blob.size <= options.maxSizeBytes) break;

      if (outputType === 'image/jpeg' && quality > minQuality) {
        quality = Math.max(minQuality, quality - 0.1);
        continue;
      }

      const nextWidth = Math.round(currentWidth * 0.84);
      if (nextWidth < MIN_OUTPUT_WIDTH || nextWidth >= currentWidth) break;
      currentWidth = nextWidth;
      currentHeight = Math.max(
        1,
        Math.round(bitmap.height * (currentWidth / bitmap.width)),
      );
      quality = Math.max(minQuality, Math.min(quality + 0.08, DEFAULT_JPEG_QUALITY));
    }

    if (!blob) {
      return { file, originalFile: file, skipped: true, reason: 'blob-failed' };
    }

    if (!needsSizeReduction && blob.size >= workingFile.size) {
      return { file, originalFile: file, skipped: true, reason: 'not-smaller' };
    }

    const nextName = buildPreprocessedName(workingFile.name, outputType);
    const nextFile = new File([blob], nextName, { type: outputType, lastModified: Date.now() });

    return { file: nextFile, originalFile: file, skipped: false };
  } finally {
    bitmap.close();
  }
}
