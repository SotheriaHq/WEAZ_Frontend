export type ImagePreprocessProfile = 'avatar' | 'banner' | 'card' | 'detail';

export interface ImagePreprocessResult {
  file: File;
  originalFile: File;
  skipped: boolean;
  reason?: string;
}

export interface ImagePreprocessOptions {
  maxSizeBytes?: number;
  /**
   * A best-effort reduction target expressed as a fraction of the source
   * file. `0.9` means "try to make the result at least 90% smaller". It is a
   * target rather than a guarantee: a small, already-efficient image should
   * never be enlarged or visibly destroyed merely to hit a byte number.
   */
  targetReductionRatio?: number;
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
const MIN_TARGET_BYTES = 64 * 1024;
const DEFAULT_JPEG_QUALITY = 0.99;
const DEFAULT_MIN_JPEG_QUALITY = 0.9;
const MAX_SIZE_ATTEMPTS = 12;

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
  const ext =
    outputType === 'image/png'
      ? 'png'
      : outputType === 'image/webp'
        ? 'webp'
        : 'jpg';
  return name.replace(/\.[^.]+$/, '') + `.pre.${ext}`;
};

const isLossyOutputType = (outputType: string) =>
  outputType === 'image/jpeg' || outputType === 'image/webp';

const encodeCanvas = async (
  canvas: HTMLCanvasElement,
  outputType: string,
  quality: number,
) => {
  const blob = await canvasToBlob(
    canvas,
    outputType,
    isLossyOutputType(outputType) ? quality : undefined,
  );
  if (
    outputType !== 'image/webp' ||
    (blob && String(blob.type || '').toLowerCase() === 'image/webp')
  ) {
    return { blob, outputType };
  }

  return {
    blob: await canvasToBlob(canvas, 'image/jpeg', quality),
    outputType: 'image/jpeg',
  };
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
    const requestedReductionRatio = Math.max(
      0,
      Math.min(options.targetReductionRatio ?? 0, 0.95),
    );
    const reductionTargetBytes =
      requestedReductionRatio > 0
        ? Math.max(
            MIN_TARGET_BYTES,
            Math.floor(workingFile.size * (1 - requestedReductionRatio)),
          )
        : undefined;
    const targetSizeBytes = Math.min(
      options.maxSizeBytes ?? Number.POSITIVE_INFINITY,
      reductionTargetBytes ?? Number.POSITIVE_INFINITY,
    );
    const needsSizeReduction = workingFile.size > targetSizeBytes;

    if (!needsResize && !needsSizeReduction) {
      return { file, originalFile: file, skipped: true, reason: 'already-optimal' };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, originalFile: file, skipped: true, reason: 'context-unavailable' };
    }

    let outputType =
      workingFile.type === 'image/png' && !needsSizeReduction
        ? 'image/png'
        : 'image/webp';
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
    let bestBlob: Blob | null = null;
    let bestOutputType = outputType;

    for (let attempt = 0; attempt < MAX_SIZE_ATTEMPTS; attempt += 1) {
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.clearRect(0, 0, currentWidth, currentHeight);
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, currentWidth, currentHeight);
      }
      ctx.drawImage(bitmap, 0, 0, currentWidth, currentHeight);

      const encoded = await encodeCanvas(canvas, outputType, quality);
      const blob = encoded.blob;
      outputType = encoded.outputType;

      if (!blob) break;
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestOutputType = outputType;
      }

      if (blob.size <= targetSizeBytes) break;

      const nextWidth = Math.round(currentWidth * 0.84);
      if (nextWidth >= MIN_OUTPUT_WIDTH && nextWidth < currentWidth) {
        // Reducing dimensions preserves texture better than repeatedly
        // lowering JPEG/WebP quality. Keep the 99% starting quality while
        // there is still useful pixel area to remove.
        currentWidth = nextWidth;
        currentHeight = Math.max(
          1,
          Math.round(bitmap.height * (currentWidth / bitmap.width)),
        );
        continue;
      }

      if (isLossyOutputType(outputType) && quality > minQuality) {
        quality = Math.max(minQuality, quality - 0.02);
        continue;
      }

      break;
    }

    if (!bestBlob) {
      return { file, originalFile: file, skipped: true, reason: 'blob-failed' };
    }

    // A compression pass must never make a creator upload more bytes. This
    // matters especially for small WebP/JPEG source files that are already
    // efficiently encoded.
    if (bestBlob.size >= workingFile.size) {
      return { file, originalFile: file, skipped: true, reason: 'not-smaller' };
    }

    const nextName = buildPreprocessedName(workingFile.name, bestOutputType);
    const nextFile = new File([bestBlob], nextName, {
      type: bestOutputType,
      lastModified: Date.now(),
    });

    return { file: nextFile, originalFile: file, skipped: false };
  } finally {
    bitmap.close();
  }
}
