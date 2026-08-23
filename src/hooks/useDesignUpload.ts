import { useCallback, useEffect, useRef, useState } from 'react';
import type { SizingMode } from '@/types/sizing';
import type { MediaItem } from '../types/media';
import { normalizeMediaViewSlot } from '@/utils/contentIntegrity';
import {
  finalizeDesignUploads,
  initializeDesignUploads,
  resolveDesignId,
  type CompletionDto,
  type DesignFitPreference,
  type DesignMetadata,
  type DesignTargetAgeGroup,
  type PresignEntry,
} from '../api/DesignApi';
import { WEB_UPLOAD_POLICIES, assertValidUploadFiles } from '@/utils/uploadValidation';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';
import { preprocessImageFile } from '@/utils/imagePreprocess';
import { getNormalizedImageFile } from '@/api/UploadApi';
import {
  sniffImageFormat,
  isBrowserDisplayableSniff,
  isUnreadableSniff,
  type SniffedImageFormat,
} from '@/utils/imageByteSniff';

const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;

type UploadSource = File | MediaItem;

type UploadOptions = {
  visibility?: 'PUBLIC' | 'PRIVATE';
  categoryId?: string;
  subCategoryId?: string;
  categoryTypeId?: string;
  type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
  filterValueIds?: string[];
  coverIndex?: number;
  sizingMode?: SizingMode;
  rtwSizeSystem?: string;
  rtwSizeType?: 'PREDEFINED' | 'FREEFORM' | 'MIXED';
  customGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  customMeasurementKeys?: string[];
  customOrderEnabled?: boolean;
  fitPreference?: DesignFitPreference;
  targetAgeGroup?: DesignTargetAgeGroup;
};

type ParsedUploadArgs = {
  items: UploadSource[];
  title: string;
  description?: string;
  minPrice?: number;
  maxPrice?: number;
  tags: string[];
  options: UploadOptions;
  onProgress?: (value: number) => void;
  shouldPublish: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const optionalString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : undefined;
};

const resolveFile = (item: UploadSource): File | null => {
  if (item instanceof File) {
    return item;
  }

  if (isRecord(item) && item.file instanceof File) {
    return item.file;
  }

  return null;
};

const fileDiagnostic = (file: File) => ({
  name: file.name,
  type: file.type,
  size: file.size,
});

type PreparedUploadItem = {
  file: File;
  originalFile: File;
  viewSlot: ReturnType<typeof normalizeMediaViewSlot>;
  optimized: boolean;
  reason?: string;
};

const uploadHost = (entry: PresignEntry) => {
  try {
    return new URL(entry.uploadUrl).host;
  } catch {
    return 'invalid-url';
  }
};

const resolveViewSlot = (item: UploadSource, index: number) => {
  if (item instanceof File) {
    return normalizeMediaViewSlot(null, index);
  }
  return normalizeMediaViewSlot(item.viewSlot, index);
};

const isImageUploadFile = (file: File) =>
  file.type.trim().toLowerCase().startsWith('image/') ||
  /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name);

/**
 * Backstop only: selection-time normalization in useMediaStore already
 * converts undecodable files (HEIC named .jpg etc.) to server JPEGs, so this
 * usually hits the shared transcode cache. It exists for files that entered
 * the flow without the media store or whose normalization failed earlier.
 */
const prepareViaServerTranscode = async (
  file: File,
  maxSizeBytes: number,
  sniffedFormat: SniffedImageFormat,
): Promise<File | null> => {
  if (!isImageUploadFile(file)) return null;
  addClientDiagnostic('info', 'design-upload', 'Requesting server media transcode', {
    file: fileDiagnostic(file),
    sniffedFormat,
  });
  if (isUnreadableSniff(sniffedFormat)) {
    return null;
  }
  try {
    const transcoded = await getNormalizedImageFile(file, {
      maxWidth: 2048,
      quality: 99,
      maxBytes: Math.max(100 * 1024, Math.min(maxSizeBytes, Math.floor(file.size * 0.1))),
    });
    if (transcoded.size > maxSizeBytes) return null;
    addClientDiagnostic('info', 'design-upload', 'Server media transcode succeeded', {
      original: fileDiagnostic(file),
      prepared: fileDiagnostic(transcoded),
      sniffedFormat,
    });
    return transcoded;
  } catch (error) {
    addClientDiagnostic('warn', 'design-upload', 'Server media transcode failed', {
      file: fileDiagnostic(file),
      sniffedFormat,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const isAlreadyUploadReady = (file: File, maxSizeBytes: number) => {
  if (!isImageUploadFile(file)) return file.size <= maxSizeBytes;
  const type = file.type.trim().toLowerCase();
  // Animated GIF is the sole preservation exception. Browser canvas would turn
  // it into a still image; all static images must carry the optimizer's `.pre`
  // marker before this upload boundary can skip reprocessing.
  if (file.size <= maxSizeBytes && /image\/gif/i.test(type)) {
    return true;
  }
  if (file.size <= maxSizeBytes && /\.pre\.(jpe?g|png|webp)$/i.test(file.name)) {
    return true;
  }
  return false;
};

const prepareDesignUploadItems = async (
  items: UploadSource[],
): Promise<PreparedUploadItem[]> => {
  const maxSizeBytes = WEB_UPLOAD_POLICIES.designMedia.maxSizeBytes;
  const prepared = await Promise.all(
    items.map(async (item, index): Promise<PreparedUploadItem | null> => {
      const file = resolveFile(item);
      if (!file) return null;
      const viewSlot = resolveViewSlot(item, index);

      if (isAlreadyUploadReady(file, maxSizeBytes)) {
        return {
          file,
          originalFile: file,
          viewSlot,
          optimized: false,
          reason: 'already-ready',
        };
      }

      let localFailureReason: string | undefined;
      try {
        const processed = await preprocessImageFile(file, 'detail', {
          maxSizeBytes,
          targetReductionRatio: 0.9,
          quality: 0.99,
          minQuality: 0.9,
        });
        if (processed.file.size <= maxSizeBytes || !isImageUploadFile(file)) {
          return {
            file: processed.file,
            originalFile: file,
            viewSlot,
            optimized: !processed.skipped,
            reason: processed.reason,
          };
        }
        localFailureReason = 'still-over-limit';
      } catch (error) {
        addClientDiagnostic('warn', 'design-upload', 'Image preprocessing failed', {
          file: fileDiagnostic(file),
          error: error instanceof Error ? error.message : String(error),
        });
        localFailureReason = 'preprocess-failed';
      }

      // Server-normalize when the file is oversized OR its bytes are not
      // browser-decodable (HEIC named .jpg, unknown container) — size is not
      // the test: an under-limit HEIC uploaded raw breaks direct display and
      // can strand non-HEIC garbage in "rendering" at the variant worker.
      const sniffedFormat = isImageUploadFile(file)
        ? await sniffImageFormat(file)
        : undefined;
      const needsServerTranscode =
        sniffedFormat !== undefined &&
        (file.size > maxSizeBytes ||
          localFailureReason === 'still-over-limit' ||
          (localFailureReason === 'preprocess-failed' &&
            !isBrowserDisplayableSniff(sniffedFormat)));

      if (needsServerTranscode) {
        const transcoded = await prepareViaServerTranscode(
          file,
          maxSizeBytes,
          sniffedFormat,
        );
        if (transcoded) {
          return {
            file: transcoded,
            originalFile: file,
            viewSlot,
            optimized: true,
            reason: 'server-transcoded',
          };
        }
      }

      return {
        file,
        originalFile: file,
        viewSlot,
        optimized: false,
        reason: localFailureReason,
      };
    }),
  );

  const preparedItems = prepared.filter(
    (entry): entry is PreparedUploadItem => entry !== null,
  );

  // Every optimization path (local decode AND server transcode) failed for an
  // oversized image. The policy message ("must be 2 MB or smaller") would
  // blame the user for a pipeline failure — say what actually happened.
  const unoptimizable = preparedItems.find(
    (entry) =>
      isImageUploadFile(entry.file) &&
      entry.file.size > maxSizeBytes &&
      (entry.reason === 'preprocess-failed' || entry.reason === 'still-over-limit'),
  );
  if (unoptimizable) {
    throw new Error(
      `${unoptimizable.originalFile.name} couldn't be optimized on this device — check your connection and save again, or re-add the photo.`,
    );
  }

  return preparedItems;
};

const computeAggregateProgress = (
  progressMap: Record<string, number>,
  totalFiles: number,
) => {
  if (totalFiles <= 0) {
    return 0;
  }

  const sum = Object.values(progressMap).reduce(
    (accumulator, value) => accumulator + clamp(value),
    0,
  );
  return Math.round(sum / totalFiles);
};

const parseUploadArgs = (args: unknown[]): ParsedUploadArgs => {
  const [
    itemsArg,
    titleArg,
    descriptionArg,
    minPriceArg,
    maxPriceArg,
    ,
    tagsArg,
    optionsArg,
    maybeProgressArg,
    maybeShouldPublishArg,
  ] = args;

  const items = Array.isArray(itemsArg) ? (itemsArg as UploadSource[]) : [];
  const title = typeof titleArg === 'string' ? titleArg : '';
  const description =
    typeof descriptionArg === 'string' ? descriptionArg : undefined;
  const minPrice =
    typeof minPriceArg === 'number' && Number.isFinite(minPriceArg)
      ? minPriceArg
      : undefined;
  const maxPrice =
    typeof maxPriceArg === 'number' && Number.isFinite(maxPriceArg)
      ? maxPriceArg
      : undefined;
  const tags = Array.isArray(tagsArg)
    ? tagsArg.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const options = isRecord(optionsArg) ? (optionsArg as UploadOptions) : {};
  const onProgress =
    typeof maybeProgressArg === 'function'
      ? (maybeProgressArg as (value: number) => void)
      : undefined;
  const shouldPublish =
    typeof maybeShouldPublishArg === 'boolean'
      ? maybeShouldPublishArg
      : typeof maybeProgressArg === 'boolean'
        ? maybeProgressArg
        : true;

  return {
    items,
    title,
    description,
    minPrice,
    maxPrice,
    tags,
    options,
    onProgress,
    shouldPublish,
  };
};

export const buildDesignUploadMetadata = (
  parsed: ParsedUploadArgs,
): DesignMetadata => {
  const { options } = parsed;
  const resolvedCategoryTypeId =
    optionalString(options.categoryTypeId) ?? optionalString(options.subCategoryId);

  return {
    title: optionalString(parsed.title),
    description: optionalString(parsed.description),
    visibility: options.visibility,
    type: options.type,
    categoryId: optionalString(options.categoryId),
    subCategoryId: optionalString(options.subCategoryId),
    categoryTypeId: resolvedCategoryTypeId,
    tags: parsed.tags,
    filterValueIds: options.filterValueIds,
    sizingMode: options.sizingMode,
    rtwSizeSystem: optionalString(options.rtwSizeSystem),
    rtwSizeType: options.rtwSizeType,
    customGender: options.customGender,
    customMeasurementKeys: options.customMeasurementKeys,
    customOrderEnabled: options.customOrderEnabled,
    fitPreference: options.fitPreference,
    targetAgeGroup: options.targetAgeGroup,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
  };
};

const uploadPresignedFile = async (
  entry: PresignEntry,
  file: File,
  onProgress: (value: number) => void,
  activeRequestsRef: { current: Set<XMLHttpRequest> },
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    if (!entry.uploadUrl) {
      reject(new Error(`Missing upload URL for ${file.name}`));
      return;
    }

    const xhr = new XMLHttpRequest();
    activeRequestsRef.current.add(xhr);
    const cleanup = () => {
      activeRequestsRef.current.delete(xhr);
    };
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => {
      cleanup();
      addClientDiagnostic('error', 'design-upload', 'Presigned file upload network error', {
        file: fileDiagnostic(file),
        fileId: entry.fileId,
        method: entry.method ?? (entry.uploadFields ? 'POST' : 'PUT'),
        host: uploadHost(entry),
        status: xhr.status,
      });
      reject(new Error('File upload failed'));
    };
    xhr.onabort = () => {
      cleanup();
      addClientDiagnostic('warn', 'design-upload', 'Presigned file upload aborted', {
        file: fileDiagnostic(file),
        fileId: entry.fileId,
        method: entry.method ?? (entry.uploadFields ? 'POST' : 'PUT'),
        host: uploadHost(entry),
      });
      reject(new Error('Upload cancelled'));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        addClientDiagnostic('info', 'design-upload', 'Presigned file upload completed', {
          file: fileDiagnostic(file),
          fileId: entry.fileId,
          method: entry.method ?? (entry.uploadFields ? 'POST' : 'PUT'),
          host: uploadHost(entry),
          status: xhr.status,
        });
        resolve();
      } else {
        addClientDiagnostic('error', 'design-upload', 'Presigned file upload returned non-2xx', {
          file: fileDiagnostic(file),
          fileId: entry.fileId,
          method: entry.method ?? (entry.uploadFields ? 'POST' : 'PUT'),
          host: uploadHost(entry),
          status: xhr.status,
        });
        reject(new Error(`File upload failed with status ${xhr.status}`));
      }
    };

    const method = entry.method ?? (entry.uploadFields ? 'POST' : 'PUT');
    try {
      xhr.open(method, entry.uploadUrl, true);
    } catch {
      addClientDiagnostic('error', 'design-upload', 'Invalid presigned upload URL', {
        file: fileDiagnostic(file),
        fileId: entry.fileId,
        method,
      });
      reject(new Error(`Invalid upload URL: ${entry.uploadUrl}`));
      return;
    }

    addClientDiagnostic('info', 'design-upload', 'Starting presigned file upload', {
      file: fileDiagnostic(file),
      fileId: entry.fileId,
      method,
      host: uploadHost(entry),
    });

    if (method === 'POST') {
      const form = new FormData();
      if (entry.uploadFields) {
        Object.entries(entry.uploadFields).forEach(([key, value]) => {
          form.append(key, value);
        });
      }
      form.append('file', file, file.name);
      xhr.send(form);
      return;
    }

    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
};

export function useDesignUpload() {
  const [progress, setProgress] = useState(0);
  const [perFileProgress, setPerFileProgress] = useState<Record<string, number>>(
    {},
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const uploadDesign = useCallback(async (...args: unknown[]) => {
    const parsed = parseUploadArgs(args);
    const originalFiles = parsed.items
      .map(resolveFile)
      .filter((file): file is File => file !== null);
    addClientDiagnostic('info', 'design-upload', 'Upload flow started', {
      shouldPublish: parsed.shouldPublish,
      fileCount: originalFiles.length,
      files: originalFiles.map(fileDiagnostic),
    });

    const uploadItems = await prepareDesignUploadItems(parsed.items);
    const resolvedFiles = uploadItems.map((item) => item.file);
    const optimizedItems = uploadItems.filter((item) => item.optimized);
    addClientDiagnostic('info', 'design-upload', 'Upload media prepared', {
      shouldPublish: parsed.shouldPublish,
      fileCount: resolvedFiles.length,
      optimizedCount: optimizedItems.length,
      files: uploadItems.map((item) => ({
        original: fileDiagnostic(item.originalFile),
        prepared: fileDiagnostic(item.file),
        optimized: item.optimized,
        reason: item.reason,
      })),
    });
    assertValidUploadFiles(resolvedFiles, WEB_UPLOAD_POLICIES.designMedia);

    if (parsed.shouldPublish) {
      if (resolvedFiles.length === 0) {
        throw new Error('No files to upload');
      }

      const normalizedTags = parsed.tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const normalizedCategoryId = optionalString(parsed.options.categoryId);
      const normalizedSubCategoryId =
        optionalString(parsed.options.subCategoryId) ??
        optionalString(parsed.options.categoryTypeId);

      if (normalizedTags.length === 0) {
        throw new Error('Add at least one tag to describe this design.');
      }
      if (!normalizedCategoryId) {
        throw new Error('Please select a category before publishing.');
      }
      if (!normalizedSubCategoryId) {
        throw new Error('Please select a sub-category before publishing.');
      }
    }

    if (mountedRef.current) {
      setIsUploading(true);
      setProgress(0);
      setPerFileProgress({});
      setError(null);
    }

    // Exposed on thrown errors so callers can reconcile: once initialize
    // succeeds a draft design EXISTS server-side even if upload/finalize
    // later fails — task cards must not pretend otherwise.
    let createdDesignId: string | undefined;
    let failureStage: 'initialize' | 'upload' | 'finalize' = 'initialize';

    try {
      addClientDiagnostic('info', 'design-upload', 'Initializing design uploads', {
        shouldPublish: parsed.shouldPublish,
        fileCount: uploadItems.length,
      });

      const initResp = await initializeDesignUploads({
        title: normalizeString(parsed.title),
        description: optionalString(parsed.description),
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        tags: parsed.tags,
        files: uploadItems.map(({ file, viewSlot }) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          viewSlot,
        })),
        draftOnly: !parsed.shouldPublish,
        categoryId: optionalString(parsed.options.categoryId),
        subCategoryId: optionalString(parsed.options.subCategoryId),
        categoryTypeId: optionalString(parsed.options.categoryTypeId),
        type: parsed.options.type,
        visibility: parsed.options.visibility,
        filterValueIds: parsed.options.filterValueIds,
        sizingMode: parsed.options.sizingMode,
        rtwSizeSystem: optionalString(parsed.options.rtwSizeSystem),
        rtwSizeType: parsed.options.rtwSizeType,
        customGender: parsed.options.customGender,
        customMeasurementKeys: parsed.options.customMeasurementKeys,
        customOrderEnabled: parsed.options.customOrderEnabled,
        fitPreference: parsed.options.fitPreference,
        targetAgeGroup: parsed.options.targetAgeGroup,
      });

      const designId = resolveDesignId(initResp);
      if (!designId) {
        throw new Error('Server did not return a design id');
      }
      createdDesignId = designId;
      failureStage = 'upload';

      const uploads = Array.isArray(initResp.uploads) ? initResp.uploads : [];
      addClientDiagnostic('info', 'design-upload', 'Design uploads initialized', {
        designId,
        uploadCount: uploads.length,
      });
      if (resolvedFiles.length > 0 && uploads.length === 0) {
        throw new Error('Server did not return upload instructions');
      }

      let progressSnapshot: Record<string, number> = {};

      if (uploads.length > 0 && mountedRef.current) {
        progressSnapshot = Object.fromEntries(
          uploads.map((entry) => [entry.fileId, 0]),
        ) as Record<string, number>;
        setPerFileProgress(
          progressSnapshot,
        );
      }

      const updateFileProgress = (fileId: string, value: number) => {
        progressSnapshot = {
          ...progressSnapshot,
          [fileId]: clamp(value),
        };
        const aggregate = computeAggregateProgress(progressSnapshot, uploads.length);
        if (mountedRef.current) {
          setPerFileProgress(progressSnapshot);
          setProgress(aggregate);
        }
        parsed.onProgress?.(aggregate);
      };

      const completions: CompletionDto[] = [];
      await Promise.all(
        uploads.map(async (entry, index) => {
          const file = resolvedFiles[index];
          if (!file) {
            throw new Error('Missing file for presign entry');
          }

          let attempt = 0;
          while (attempt <= MAX_RETRY_ATTEMPTS) {
            try {
              await uploadPresignedFile(entry, file, (value) =>
                updateFileProgress(entry.fileId, value),
                activeXhrsRef,
              );
          completions.push({
            fileId: entry.fileId,
            s3Key: entry.expectedKey,
            actualSize: file.size,
            actualMimeType: file.type,
            viewSlot: entry.viewSlot ?? uploadItems[index]?.viewSlot,
          });
              updateFileProgress(entry.fileId, 100);
              break;
            } catch (uploadError) {
              attempt += 1;
              if (attempt > MAX_RETRY_ATTEMPTS) {
                throw uploadError instanceof Error
                  ? uploadError
                  : new Error('File upload failed');
              }
              await sleep(RETRY_DELAY_MS * attempt);
            }
          }
        }),
      );

      failureStage = 'finalize';
      addClientDiagnostic('info', 'design-upload', 'Finalizing design uploads', {
        designId,
        completionCount: completions.length,
        shouldPublish: parsed.shouldPublish,
      });

      const finalized = await finalizeDesignUploads(
        designId,
        completions,
        parsed.shouldPublish,
        {
          action: parsed.shouldPublish ? 'publish' : 'draft',
          coverIndex: parsed.options.coverIndex,
          designMetadata: buildDesignUploadMetadata(parsed),
        },
      );

      if (mountedRef.current) {
        setProgress(100);
        setPerFileProgress({});
      }
      parsed.onProgress?.(100);
      addClientDiagnostic('info', 'design-upload', 'Upload flow completed', {
        designId,
        shouldPublish: parsed.shouldPublish,
      });
      return finalized;
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error ? caughtError : new Error('Upload failed');
      if (createdDesignId) {
        (normalizedError as Error & { designId?: string; stage?: string }).designId =
          createdDesignId;
        (normalizedError as Error & { designId?: string; stage?: string }).stage =
          failureStage;
      }
      addClientDiagnostic('error', 'design-upload', 'Upload flow failed', {
        shouldPublish: parsed.shouldPublish,
        fileCount: resolvedFiles.length,
        designId: createdDesignId,
        stage: failureStage,
        errorName: normalizedError.name,
        errorMessage: normalizedError.message,
      });
      if (mountedRef.current) {
        setError(normalizedError);
      }
      throw normalizedError;
    } finally {
      if (mountedRef.current) {
        setIsUploading(false);
      }
    }
  }, []);

  const cancelUploads = useCallback(() => {
    for (const xhr of Array.from(activeXhrsRef.current)) {
      xhr.abort();
    }
    activeXhrsRef.current.clear();
  }, []);

  return { uploadDesign, cancelUploads, isUploading, progress, perFileProgress, error } as const;
}

export default useDesignUpload;
