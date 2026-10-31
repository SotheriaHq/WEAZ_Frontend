export interface ImagePreprocessResult {
  file: File;
  originalFile: File;
  skipped: boolean;
  reason?: string;
}

export interface ImagePreprocessOptions {
  /** The hard ceiling: what the API accepts. */
  maxSizeBytes?: number;
  /** What to aim for. A result between this and the ceiling still uploads. */
  preferredSizeBytes?: number;
}

const MAX_INPUT_PIXELS = 50_000_000;
const PASSTHROUGH_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAY_BE_LOSSLESS_TYPES = new Set(['image/png', 'image/webp', 'image/avif']);
const MAY_HAVE_ALPHA_TYPES = MAY_BE_LOSSLESS_TYPES;

// Compression only: the output always keeps the source's pixel dimensions.
// Best quality first, and the last entry is the floor for reaching the target.
const QUALITIES = [0.95, 0.9, 0.85, 0.8];
// The largest view served is 2048 pixels wide. A photo with far more pixels than
// that is scaled down on the way, which hides heavier compression.
const LARGE_PHOTO_PIXELS = 8_000_000;
const LARGE_PHOTO_QUALITIES = [...QUALITIES, 0.7, 0.6];
// Only ever spent to get under the ceiling, because a softer photo is better than
// a refused one. WebP, since JPEG cannot bring 24MP and above that far down.
const LAST_RESORT_WEBP_QUALITIES = [0.6, 0.5, 0.4];

// Each encode holds a full-resolution bitmap and canvas in memory, and a design
// prepares all its photos at once. Two at a time keeps a phone browser alive.
const MAX_CONCURRENT_ENCODES = 2;
let activeEncodes = 0;
const encodeWaiters: Array<() => void> = [];
const acquireEncode = async () => {
  if (activeEncodes < MAX_CONCURRENT_ENCODES) { activeEncodes += 1; return; }
  await new Promise<void>((resolve) => encodeWaiters.push(resolve));
};
const releaseEncode = () => {
  const next = encodeWaiters.shift();
  if (next) next();
  else activeEncodes -= 1;
};

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
  const targetBytes = Math.min(options.preferredSizeBytes ?? maxBytes, maxBytes);
  const workingFile = file.type.toLowerCase() === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
  fallbackFile = workingFile;
  await acquireEncode();
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(workingFile);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_INPUT_PIXELS)
      throw new Error('Image dimensions are too large. Choose a smaller image.');
    const fitsTarget = workingFile.size <= targetBytes && PASSTHROUGH_TYPES.has(type);
    const fitsCeiling = workingFile.size <= maxBytes && PASSTHROUGH_TYPES.has(type);
    // An efficient source is a better master than a second lossy generation.
    if (fitsTarget && type !== 'image/png')
      return unchanged('already-optimal');
    if (fitsTarget && workingFile.size < 64 * 1024)
      return unchanged('already-optimal');
    canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return unchanged('context-unavailable');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    const finished = (blob: Blob): ImagePreprocessResult => {
      const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const next = new File([blob], workingFile.name.replace(/\.[^.]+$/, '') + `.pre.${extension}`, { type: blob.type, lastModified: file.lastModified });
      return { file: next, originalFile: file, skipped: false };
    };

    // Flat artwork and screenshots can fit with no loss at all, so a lossless
    // file that plausibly fits is worth one attempt before any quality is spent.
    if (MAY_BE_LOSSLESS_TYPES.has(type) && workingFile.size <= targetBytes * 2) {
      let blob = await canvasToBlob(canvas, 'image/webp', 1);
      // Canvas quality=1 is not a cross-browser lossless guarantee. Inspect the
      // WebP bitstream; PNG is the lossless fallback and preserves transparency.
      if (!blob || !(await isLosslessWebp(blob))) blob = await canvasToBlob(canvas, 'image/png');
      if (blob && !['image/png', 'image/webp'].includes(blob.type)) blob = null;
      if (!blob) return unchanged('blob-failed');
      if (blob.size <= targetBytes) {
        if (fitsTarget && blob.size >= workingFile.size) return unchanged('not-smaller');
        return finished(blob);
      }
    }
    if (fitsTarget) return unchanged('original-within-upload-limit');

    const surface = canvas;
    const mayHaveAlpha = MAY_HAVE_ALPHA_TYPES.has(type);
    // Safari encodes no WebP at all; its canvas answers with a PNG instead.
    const encodeWebp = async (quality: number) => {
      const blob = await canvasToBlob(surface, 'image/webp', quality);
      if (!blob || blob.type === 'image/webp') return blob;
      // JPEG has no transparency and would turn it black.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, surface.width, surface.height);
      return canvasToBlob(surface, 'image/jpeg', quality);
    };
    const encode = (quality: number) =>
      mayHaveAlpha ? encodeWebp(quality) : canvasToBlob(surface, 'image/jpeg', quality);
    if (mayHaveAlpha && fitsCeiling) {
      // Flattening transparency is only worth it when the file cannot go up as it is.
      const probe = await canvasToBlob(surface, 'image/webp', QUALITIES[0]);
      if (probe?.type !== 'image/webp') return unchanged('alpha-preserved');
    }

    // The highest quality that fits, by bisection: three encodes at most.
    const qualities = bitmap.width * bitmap.height >= LARGE_PHOTO_PIXELS ? LARGE_PHOTO_QUALITIES : QUALITIES;
    const floorRung = qualities.length - 1;
    let fit: Blob | null = null;
    let atFloor: Blob | null = null;
    let low = 0;
    let high = floorRung;
    for (let rung = Math.floor(high / 2); low <= high; rung = Math.floor((low + high) / 2)) {
      const blob = await encode(qualities[rung]);
      if (!blob) return unchanged('blob-failed');
      if (rung === floorRung) atFloor = blob;
      if (blob.size <= targetBytes) { fit = blob; high = rung - 1; } else low = rung + 1;
    }
    if (fit) return finished(fit);
    if (!atFloor) return unchanged('blob-failed');

    // The target is only an aim, and more quality will not be spent chasing it.
    // Anything the API accepts goes up.
    if (fitsCeiling) return unchanged('original-within-upload-limit');
    if (atFloor.size <= maxBytes) return finished(atFloor);

    for (const quality of LAST_RESORT_WEBP_QUALITIES) {
      const blob = await encodeWebp(quality);
      if (!blob) return unchanged('blob-failed');
      if (blob.size <= maxBytes) return finished(blob);
    }
    throw new Error('This image is too detailed to fit the upload limit. Choose a smaller original.');
  } finally {
    bitmap?.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    releaseEncode();
  }
}
