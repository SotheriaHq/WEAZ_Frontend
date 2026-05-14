import { useCallback, useRef, useState } from 'react';
import type { SizingMode } from '@/types/sizing';
import type { MediaItem } from '../types/media';
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
      reject(new Error('File upload failed'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`File upload failed with status ${xhr.status}`));
      }
    };

    const method = entry.method ?? (entry.uploadFields ? 'POST' : 'PUT');
    try {
      xhr.open(method, entry.uploadUrl, true);
    } catch {
      reject(new Error(`Invalid upload URL: ${entry.uploadUrl}`));
      return;
    }

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

  const uploadDesign = useCallback(async (...args: unknown[]) => {
    const parsed = parseUploadArgs(args);
    const resolvedFiles = parsed.items
      .map(resolveFile)
      .filter((file): file is File => file !== null);

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

    setIsUploading(true);
    setProgress(0);
    setPerFileProgress({});
    setError(null);

    try {
      const initResp = await initializeDesignUploads({
        title: normalizeString(parsed.title),
        description: optionalString(parsed.description),
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        tags: parsed.tags,
        files: resolvedFiles.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
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

      const uploads = Array.isArray(initResp.uploads) ? initResp.uploads : [];
      if (resolvedFiles.length > 0 && uploads.length === 0) {
        throw new Error('Server did not return upload instructions');
      }

      if (uploads.length > 0) {
        setPerFileProgress(
          Object.fromEntries(uploads.map((entry) => [entry.fileId, 0])) as Record<
            string,
            number
          >,
        );
      }

      const updateFileProgress = (fileId: string, value: number) => {
        setPerFileProgress((current) => {
          const next = {
            ...current,
            [fileId]: clamp(value),
          };
          const aggregate = computeAggregateProgress(next, uploads.length);
          setProgress(aggregate);
          parsed.onProgress?.(aggregate);
          return next;
        });
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

      setProgress(100);
      setPerFileProgress({});
      parsed.onProgress?.(100);
      return finalized;
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error ? caughtError : new Error('Upload failed');
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsUploading(false);
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
