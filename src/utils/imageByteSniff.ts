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

const readBlobHead = async (blob: Blob): Promise<ArrayBuffer> => {
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
      reject(new Error('Blob head read failed'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Blob head read failed'));
    reader.readAsArrayBuffer(blob);
  });
};

export const sniffImageFormat = async (
  file: File,
): Promise<SniffedImageFormat> => {
  try {
    const head = await readBlobHead(file.slice(0, 32));
    return sniffImageFormatFromBytes(new Uint8Array(head));
  } catch {
    // The picker returned a handle whose bytes cannot be read (cloud-only
    // photo, revoked content:// URI). Nothing downstream can succeed.
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
