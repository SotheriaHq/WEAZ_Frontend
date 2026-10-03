/**
 * Magic-byte sniffing for picked files. File pickers lie: Android gallery apps
 * hand over HEIC bytes named `.jpg` with `type: image/jpeg`, and cloud-backed
 * photos can arrive unreadable or empty. Sniffing the real container is the
 * only way to route a file correctly (local decode vs server transcode) and
 * the only diagnostic that explains "Image probe failed" in the field.
 */

export type SniffedImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'heic'
  | 'avif'
  | 'unknown'
  | 'empty'
  | 'unreadable';

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

const AVIF_BRANDS = new Set(['avif', 'avis']);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

export const sniffImageFormatFromBytes = (
  bytes: Uint8Array,
): SniffedImageFormat => {
  if (bytes.length === 0) return 'empty';
  if (bytes.length < 12) return 'unknown';

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';

  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return 'heic';
    if (AVIF_BRANDS.has(brand)) return 'avif';
    return 'unknown';
  }

  return 'unknown';
};

export const readBlobBytes = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  // Safari 14.0 / jsdom lack Blob.arrayBuffer.
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Blob read failed'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
    reader.readAsArrayBuffer(blob);
  });
};

export const sniffImageFormat = async (
  file: File,
): Promise<SniffedImageFormat> => {
  try {
    const head = await readBlobBytes(file.slice(0, 32));
    return sniffImageFormatFromBytes(new Uint8Array(head));
  } catch {
    // The picker returned a handle whose bytes cannot be read (cloud-only
    // photo, revoked content:// URI). Nothing downstream can succeed.
    return 'unreadable';
  }
};

const FINGERPRINT_SAMPLE_BYTES = 64 * 1024;

const fnv1a = (hash: number, bytes: Uint8Array): number => {
  let next = hash;
  for (let i = 0; i < bytes.length; i += 1) {
    next ^= bytes[i];
    next = Math.imul(next, 0x01000193);
  }
  return next;
};

/**
 * Content fingerprint (FNV-1a over head + tail samples). File METADATA is not
 * identity: Android content:// picks can stamp the same lastModified (pick
 * time, or 0) on every file, so name/size/date keys can collide across
 * different photos. Sampling the bytes makes cache keys track actual content.
 * Returns 'unreadable' when the bytes cannot be read at all.
 */
export const fingerprintFileBytes = async (file: File): Promise<string> => {
  try {
    let hash = 0x811c9dc5;
    const head = await readBlobBytes(file.slice(0, FINGERPRINT_SAMPLE_BYTES));
    hash = fnv1a(hash, new Uint8Array(head));
    if (file.size > FINGERPRINT_SAMPLE_BYTES) {
      const tailStart = Math.max(
        FINGERPRINT_SAMPLE_BYTES,
        file.size - FINGERPRINT_SAMPLE_BYTES,
      );
      const tail = await readBlobBytes(file.slice(tailStart));
      hash = fnv1a(hash, new Uint8Array(tail));
    }
    return (hash >>> 0).toString(16);
  } catch {
    return 'unreadable';
  }
};

/** Formats browsers decode natively in <img> across the board. */
export const isBrowserDisplayableSniff = (
  format: SniffedImageFormat,
): boolean =>
  format === 'jpeg' ||
  format === 'png' ||
  format === 'webp' ||
  format === 'gif' ||
  format === 'bmp' ||
  format === 'avif';

/** True when the file's bytes cannot be read at all — skip every fallback. */
export const isUnreadableSniff = (format: SniffedImageFormat): boolean =>
  format === 'empty' || format === 'unreadable';
