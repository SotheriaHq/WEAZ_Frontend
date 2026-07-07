import { apiClient } from './httpClient';
import { WEB_UPLOAD_POLICIES } from '@/utils/uploadValidation';
import { fingerprintFileBytes, readBlobBytes } from '@/utils/imageByteSniff';

/**
 * Server image transcodes upload the ORIGINAL file over a phone uplink —
 * 2 MB at 1-2 Mbps up is 10-20 s alone, so the global 15 s axios timeout
 * guaranteed failure on mobile. These requests get their own budget.
 */
const SERVER_IMAGE_TRANSCODE_TIMEOUT_MS = 90_000;

/** Phones choke when 10+ previews upload at once; run a small queue. */
const MAX_CONCURRENT_TRANSCODES = 2;

const MAX_CACHED_NORMALIZED_BLOBS = 24;

/**
 * ONE canonical output profile for every consumer (selection-time normalize,
 * preview surfaces, design save, product save). Identical params mean
 * identical cache keys — a file the browser cannot decode is uploaded to the
 * server exactly once, and the result serves preview AND upload.
 */
const NORMALIZED_IMAGE_MAX_WIDTH = 2048;
const NORMALIZED_IMAGE_QUALITY = 82;
const NORMALIZED_IMAGE_MAX_BYTES = WEB_UPLOAD_POLICIES.designMedia.maxSizeBytes;

type TranscodeOptions = {
  maxWidth: number;
  quality: number;
  maxBytes: number;
};

const CANONICAL_TRANSCODE_OPTIONS: TranscodeOptions = {
  maxWidth: NORMALIZED_IMAGE_MAX_WIDTH,
  quality: NORMALIZED_IMAGE_QUALITY,
  maxBytes: NORMALIZED_IMAGE_MAX_BYTES,
};

// Metadata alone is NOT file identity: Android content:// picks can stamp
// identical lastModified (pick time, or 0) across different photos, and
// generated gallery names recur. A content fingerprint keeps the cache from
// ever serving one photo's bytes as another's preview or upload.
const fileCacheKey = async (file: File, options: TranscodeOptions) =>
  [
    file.name,
    file.size,
    file.lastModified,
    await fingerprintFileBytes(file),
    options.maxWidth,
    options.quality,
    options.maxBytes,
  ].join(':');

let activeTranscodes = 0;
const transcodeQueue: Array<() => void> = [];

const acquireTranscodeSlot = (): Promise<void> =>
  new Promise((resolve) => {
    if (activeTranscodes < MAX_CONCURRENT_TRANSCODES) {
      activeTranscodes += 1;
      resolve();
      return;
    }
    transcodeQueue.push(() => {
      activeTranscodes += 1;
      resolve();
    });
  });

const releaseTranscodeSlot = () => {
  activeTranscodes = Math.max(0, activeTranscodes - 1);
  const next = transcodeQueue.shift();
  if (next) next();
};

const inFlightTranscodes = new Map<string, Promise<Blob>>();
const resolvedTranscodes = new Map<string, Blob>();

const rememberResolvedBlob = (key: string, blob: Blob) => {
  resolvedTranscodes.set(key, blob);
  while (resolvedTranscodes.size > MAX_CACHED_NORMALIZED_BLOBS) {
    const oldest = resolvedTranscodes.keys().next().value;
    if (oldest === undefined) break;
    resolvedTranscodes.delete(oldest);
  }
};

const requestServerTranscode = async (
  file: File,
  options: TranscodeOptions,
): Promise<Blob> => {
  const key = await fileCacheKey(file, options);

  // No awaits between the cache checks and inFlightTranscodes.set below —
  // concurrent callers for the same key must observe the first one's entry.
  const cached = resolvedTranscodes.get(key);
  if (cached) return cached;

  const inFlight = inFlightTranscodes.get(key);
  if (inFlight) return inFlight;

  const request = (async () => {
    await acquireTranscodeSlot();
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('maxWidth', String(options.maxWidth));
      formData.append('quality', String(options.quality));
      formData.append('maxBytes', String(options.maxBytes));

      const response = await apiClient.post(
        '/uploads/preview-image',
        formData,
        {
          responseType: 'blob',
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: SERVER_IMAGE_TRANSCODE_TIMEOUT_MS,
        },
      );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: 'image/jpeg' });
      await assertServerJpegBlob(blob);
      rememberResolvedBlob(key, blob);
      return blob;
    } finally {
      releaseTranscodeSlot();
    }
  })();

  inFlightTranscodes.set(key, request);
  try {
    return await request;
  } finally {
    inFlightTranscodes.delete(key);
  }
};

const assertServerJpegBlob = async (blob: Blob): Promise<void> => {
  if (blob.size < 3) {
    throw new Error('Server preview returned an empty image');
  }

  const head = new Uint8Array(await readBlobBytes(blob.slice(0, 3)));
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (!isJpeg) {
    throw new Error('Server preview did not return JPEG bytes');
  }
};

const toNormalizedFile = (file: File, blob: Blob): File => {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.pre.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

/**
 * Server-side normalize for files the browser cannot decode locally (HEIC
 * named .jpg, privacy-blocked canvas): returns a JPEG File under the design
 * media size cap. Deduped + cached, so previews and uploads share one call.
 */
export const getNormalizedImageFile = async (file: File): Promise<File> => {
  const blob = await requestServerTranscode(file, CANONICAL_TRANSCODE_OPTIONS);
  return toNormalizedFile(file, blob);
};

/**
 * Returns an object URL for a server-normalized JPEG preview. Each caller
 * owns (and must revoke) its own object URL; the underlying blob is shared.
 */
export const uploadPreviewImage = async (file: File): Promise<string> => {
  const blob = await requestServerTranscode(file, CANONICAL_TRANSCODE_OPTIONS);
  return URL.createObjectURL(blob);
};
