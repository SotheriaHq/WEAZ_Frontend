export type ImagePreprocessProfile = 'avatar' | 'banner' | 'card' | 'detail';

export interface ImagePreprocessResult {
  file: File;
  originalFile: File;
  skipped: boolean;
  reason?: string;
}

const profileMaxWidth: Record<ImagePreprocessProfile, number> = {
  avatar: 512,
  banner: 1920,
  card: 1280,
  detail: 2048,
};

const MAX_INPUT_PIXELS = 50_000_000;

export async function preprocessImageFile(
  file: File,
  profile: ImagePreprocessProfile,
): Promise<ImagePreprocessResult> {
  if (!file.type.startsWith('image/')) {
    return { file, originalFile: file, skipped: true, reason: 'not-image' };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { file, originalFile: file, skipped: true, reason: 'no-dom' };
  }

  const bitmap = await createImageBitmap(file);
  try {
    const pixels = bitmap.width * bitmap.height;
    if (pixels > MAX_INPUT_PIXELS) {
      throw new Error('Image dimensions are too large. Choose a smaller image.');
    }

    const targetWidth = Math.min(bitmap.width, profileMaxWidth[profile]);
    if (targetWidth >= bitmap.width) {
      return { file, originalFile: file, skipped: true, reason: 'already-optimal' };
    }

    const ratio = targetWidth / bitmap.width;
    const targetHeight = Math.max(1, Math.round(bitmap.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, originalFile: file, skipped: true, reason: 'context-unavailable' };
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outputType === 'image/png' ? undefined : 0.86;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), outputType, quality);
    });

    if (!blob) {
      return { file, originalFile: file, skipped: true, reason: 'blob-failed' };
    }

    const ext = outputType === 'image/png' ? 'png' : 'jpg';
    const nextName = file.name.replace(/\.[^.]+$/, '') + `.pre.${ext}`;
    const nextFile = new File([blob], nextName, { type: outputType, lastModified: Date.now() });

    return { file: nextFile, originalFile: file, skipped: false };
  } finally {
    bitmap.close();
  }
}
