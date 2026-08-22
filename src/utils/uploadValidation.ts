const MB = 1024 * 1024;

export type UploadPolicy = {
  label: string;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  /**
   * The hard ceiling — above this the upload is refused.
   *
   * This must not be tighter than the server's own limit for the endpoint
   * (`DIRECT_UPLOAD_HARD_LIMIT_BYTES` in `bthreadly/src/upload/upload-policy.ts`)
   * or the client refuses files the API would have accepted.
   */
  maxSizeBytes: number;
  /**
   * What the preprocessor aims for, when that is smaller than the ceiling.
   *
   * These are two different numbers and conflating them is what broke product
   * uploads: `preprocessProductMediaFiles` compressed toward the target and
   * then REJECTED anything that did not reach it, so a photo that squeezed down
   * to 2.4MB was thrown away even though the API takes 8MB. Compress hard, but
   * refuse only at the ceiling.
   */
  preferredSizeBytes?: number;
  videoMaxSizeBytes?: number;
  maxFiles?: number;
};

export class UploadValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors[0] ?? 'This file cannot be uploaded.');
    this.name = 'UploadValidationError';
    this.errors = errors;
  }
}

/**
 * No AVIF. Not a preference — no server endpoint accepts it.
 *
 * `bthreadly/src/upload/upload-policy.ts` lists the allowed types per
 * `FileType`, and `image/avif` appears in none of them: not POST_IMAGE, not
 * PROFILE_IMAGE, not REVIEW_IMAGE, not MESSAGE_IMAGE. It was listed here, so an
 * AVIF passed every check the browser makes and was then rejected by multer
 * with a message the upload UI has no way to explain. Keeping the two lists
 * honest is the fix; adding AVIF support is a server change, not a client one.
 *
 * The preprocessor only ever emits webp/png/jpeg, so this affects the
 * pass-through path — a small AVIF chosen straight from a photo library.
 */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'] as const;

export const WEB_UPLOAD_POLICIES = {
  profileImage: {
    label: 'Profile photo',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    maxSizeBytes: 2 * MB,
    maxFiles: 1,
  },
  bannerImage: {
    label: 'Banner image',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    maxSizeBytes: 2 * MB,
    maxFiles: 1,
  },
  productMedia: {
    label: 'Product media',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    // Matches DIRECT_UPLOAD_HARD_LIMIT_BYTES[POST_IMAGE] = 8MB on the server.
    // It was 2MB, which is why "some" product uploads failed: exactly the ones
    // whose photos would not compress that far.
    maxSizeBytes: 8 * MB,
    preferredSizeBytes: 2 * MB,
    // `StoreService.maxProductMediaCount` is 6, and there are exactly 6 view
    // slots (front/back/left/right/detail/on-model) to put them in. 12 here
    // meant the client's own error message quoted a cap the API does not have.
    maxFiles: 6,
  },
  collectionMedia: {
    label: 'Collection media',
    allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
    allowedExtensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
    maxSizeBytes: 2 * MB,
    videoMaxSizeBytes: 100 * MB,
    maxFiles: 20,
  },
  designMedia: {
    label: 'Design media',
    allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
    allowedExtensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
    maxSizeBytes: 2 * MB,
    videoMaxSizeBytes: 100 * MB,
    maxFiles: 20,
  },
  reviewImage: {
    label: 'Review image',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    maxSizeBytes: 2 * MB,
    maxFiles: 4,
  },
  reviewVideo: {
    label: 'Review video',
    allowedMimeTypes: VIDEO_MIME_TYPES,
    allowedExtensions: VIDEO_EXTENSIONS,
    maxSizeBytes: 40 * MB,
    maxFiles: 1,
  },
  messageImage: {
    label: 'Message image',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    maxSizeBytes: 2 * MB,
    maxFiles: 5,
  },
  messageDocument: {
    label: 'Message document',
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['pdf'],
    maxSizeBytes: 2 * MB,
    maxFiles: 5,
  },
} as const satisfies Record<string, UploadPolicy>;

export type WebUploadPolicyName = keyof typeof WEB_UPLOAD_POLICIES;

const normalizeMimeType = (value: string | undefined | null) =>
  String(value ?? '').trim().toLowerCase().split(';')[0];

const getExtension = (name: string | undefined | null) => {
  const safeName = String(name ?? '').trim().split(/[\\/]/).pop() ?? '';
  const extension = safeName.includes('.') ? safeName.split('.').pop() : '';
  return String(extension ?? '').toLowerCase();
};

const formatBytesAsMB = (bytes: number) => {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
};

const resolveSizeLimit = (file: File, policy: UploadPolicy) => {
  const mimeType = normalizeMimeType(file.type);
  if (policy.videoMaxSizeBytes && mimeType.startsWith('video/')) {
    return policy.videoMaxSizeBytes;
  }
  return policy.maxSizeBytes;
};

export const validateUploadFile = (file: File, policy: UploadPolicy): string[] => {
  const errors: string[] = [];
  const mimeType = normalizeMimeType(file.type);
  const extension = getExtension(file.name);
  const isAllowedMime = mimeType.length > 0 && policy.allowedMimeTypes.includes(mimeType);
  const isAllowedExtension =
    extension.length > 0 && policy.allowedExtensions.includes(extension);

  if (!isAllowedMime && !isAllowedExtension) {
    errors.push(`${policy.label} must be a supported file type.`);
  }

  const maxSizeBytes = resolveSizeLimit(file, policy);
  if (typeof file.size === 'number' && file.size > maxSizeBytes) {
    errors.push(`${policy.label} must be ${formatBytesAsMB(maxSizeBytes)} or smaller.`);
  }

  return errors;
};

export const validateUploadFiles = (
  files: readonly File[],
  policy: UploadPolicy,
  options?: { existingCount?: number; maxFiles?: number },
): string[] => {
  const maxFiles = options?.maxFiles ?? policy.maxFiles;
  const totalFiles = files.length + (options?.existingCount ?? 0);
  const errors: string[] = [];

  if (typeof maxFiles === 'number' && totalFiles > maxFiles) {
    errors.push(`You can upload up to ${maxFiles} ${policy.label.toLowerCase()} files.`);
  }

  for (const file of files) {
    errors.push(...validateUploadFile(file, policy));
  }

  return errors;
};

export const assertValidUploadFile = (file: File, policy: UploadPolicy) => {
  const errors = validateUploadFile(file, policy);
  if (errors.length > 0) {
    throw new UploadValidationError(errors);
  }
};

export const assertValidUploadFiles = (
  files: readonly File[],
  policy: UploadPolicy,
  options?: { existingCount?: number; maxFiles?: number },
) => {
  const errors = validateUploadFiles(files, policy, options);
  if (errors.length > 0) {
    throw new UploadValidationError(errors);
  }
};

export const getUploadValidationMessage = (error: unknown) =>
  error instanceof UploadValidationError
    ? error.message
    : 'This file cannot be uploaded. Please choose a different file.';
