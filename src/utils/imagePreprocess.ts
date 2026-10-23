export type ImagePreprocessProfile = 'avatar' | 'banner' | 'card' | 'detail';

export interface ImagePreprocessResult {
  file: File;
  originalFile: File;
  skipped: boolean;
  reason?: string;
}

export interface ImagePreprocessOptions {
  maxSizeBytes?: number;
  /** Advisory only. A byte-reduction percentage never authorizes reducing resolution. */
  targetReductionRatio?: number;
  /** Quality for an over-budget lossy fallback; the first attempt is lossless. */
  quality?: number;
  minQuality?: number;
}

const MAX_LONG_SIDE: Record<ImagePreprocessProfile, number> = {
  avatar: 1080, banner: 2560, card: 2560, detail: 4096,
};
const MIN_LONG_SIDE: Record<ImagePreprocessProfile, number> = {
  avatar: 720, banner: 1920, card: 1920, detail: 2048,
};
const MAX_INPUT_PIXELS = 50_000_000;
const MAX_ATTEMPTS = 6;
const QUALITY_FLOOR = 0.95;
const PASSTHROUGH_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const inferImageType = (file: File) => {
  const declared = file.type.trim().toLowerCase();
  if (declared.startsWith('image/')) return declared;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  };
  return types[extension] ?? '';
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

async function isLosslessWebp(blob: Blob) {
  if (blob.type !== 'image/webp') return false;
  const bytes = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
  const view = new DataView(bytes.buffer);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (kind === 'VP8L') return true;
    if (kind === 'VP8 ') return false;
    const length = view.getUint32(offset + 4, true);
    offset += 8 + length + (length & 1);
  }
  return false;
}

export async function preprocessImageFile(
  file: File,
  profile: ImagePreprocessProfile,
  options: ImagePreprocessOptions = {},
): Promise<ImagePreprocessResult> {
  const type = inferImageType(file);
  let fallbackFile = file;
  const unchanged = (reason: string): ImagePreprocessResult => ({ file: fallbackFile, originalFile: file, skipped: true, reason });
  if (!type) return unchanged('not-image');
  if (type === 'image/gif') return unchanged('gif-preserved');
  if (typeof window === 'undefined' || typeof document === 'undefined') return unchanged('no-dom');
  const maxBytes = options.maxSizeBytes ?? Number.POSITIVE_INFINITY;
  if (!(maxBytes > 0)) throw new Error('Image upload size limit must be positive.');
  const workingFile = file.type.toLowerCase() === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
  fallbackFile = workingFile;
  const bitmap = await createImageBitmap(workingFile);
  let canvas: HTMLCanvasElement | undefined;
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_INPUT_PIXELS)
      throw new Error('Image dimensions are too large. Choose a smaller image.');
    const originalLongSide = Math.max(bitmap.width, bitmap.height);
    const fitsOriginal = workingFile.size <= maxBytes && PASSTHROUGH_TYPES.has(type);
    const initialLongSide = fitsOriginal ? originalLongSide : Math.min(originalLongSide, MAX_LONG_SIDE[profile]);
    // An efficient source is a better master than a second lossy generation.
    if (fitsOriginal && type !== 'image/png')
      return unchanged('already-optimal');
    if (fitsOriginal && workingFile.size < 64 * 1024)
      return unchanged('already-optimal');
    canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return unchanged('context-unavailable');
    const finiteQuality = (value: number | undefined, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(QUALITY_FLOOR, value)) : fallback;
    const minQuality = finiteQuality(options.minQuality, QUALITY_FLOOR);
    const fallbackQuality = Math.max(minQuality, finiteQuality(options.quality, 0.97));
    let longSide = initialLongSide;
    let quality = 1;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const scale = longSide / originalLongSide;
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let blob = await canvasToBlob(canvas, 'image/webp', quality);
      // Canvas quality=1 is not a cross-browser lossless guarantee. Inspect the
      // WebP bitstream; PNG is the lossless fallback and preserves transparency.
      if (quality === 1 && (!blob || !(await isLosslessWebp(blob))))
        blob = await canvasToBlob(canvas, 'image/png');
      if (blob && !['image/png', 'image/webp'].includes(blob.type)) blob = null;
      if (!blob) return unchanged('blob-failed');
      if (blob.size <= maxBytes) {
        if (fitsOriginal && blob.size >= workingFile.size) return unchanged('not-smaller');
        const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
        const next = new File([blob], workingFile.name.replace(/\.[^.]+$/, '') + `.pre.${extension}`, { type: blob.type, lastModified: file.lastModified });
        return { file: next, originalFile: file, skipped: false };
      }
      if (fitsOriginal) return unchanged('original-within-upload-limit');
      // Only the actual upload ceiling can trigger a lossy or smaller retry.
      if (quality === 1 && fallbackQuality < 1) { quality = fallbackQuality; continue; }
      if (quality > minQuality) { quality = Math.max(minQuality, quality - 0.02); continue; }
      const nextSide = Math.max(Math.min(originalLongSide, MIN_LONG_SIDE[profile]), Math.round(longSide * 0.9));
      if (nextSide >= longSide) break;
      longSide = nextSide;
      quality = 1;
    }
    throw new Error('This image cannot fit the upload limit while retaining detail. Choose a smaller original or crop it.');
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
