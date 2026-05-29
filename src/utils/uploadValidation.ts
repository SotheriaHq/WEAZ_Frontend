const MB = 1024 * 1024;

export type UploadPolicy = {
  label: string;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxSizeBytes: number;
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
    maxSizeBytes: 2 * MB,
    maxFiles: 12,
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
