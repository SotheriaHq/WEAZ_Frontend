/**
 * Module-level design publish job queue.
 *
 * Survives CreateDesign unmount after immediate catalog navigation. Holding
 * File blobs + running the upload outside React lifecycle is what prevents
 * the "progress stuck forever / refresh loses everything mid-upload" class of
 * bugs on mobile browsers.
 */
import {
  DesignApi,
  finalizeDesignUploads,
  initializeDesignUploads,
  resolveDesignId,
  type CompletionDto,
  type DesignMetadata,
  type PresignEntry,
} from '@/api/DesignApi';
import { customOrderConfigurationsApi } from '@/api/CustomOrderApi';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';
import { normalizeMediaViewSlot } from '@/utils/contentIntegrity';
import { preprocessImageFile } from '@/utils/imagePreprocess';
import {
  sniffImageFormat,
  isBrowserDisplayableSniff,
  isUnreadableSniff,
} from '@/utils/imageByteSniff';
import { getNormalizedImageFile } from '@/api/UploadApi';
import { WEB_UPLOAD_POLICIES, assertValidUploadFiles } from '@/utils/uploadValidation';
import {
  updatePublishTask,
  removePublishTask,
  type PublishTaskKind,
} from '@/utils/publishTracker';

export type DesignPublishJobInput = {
  taskId: string;
  ownerId?: string;
  title: string;
  description?: string;
  minPrice?: number;
  maxPrice?: number;
  tags: string[];
  files: Array<{
    file: File;
    viewSlot?: string | null;
  }>;
  coverIndex: number;
  designMetadata: DesignMetadata;
  /** When set, this is an edit-mode republish of an existing design. */
  existingDesignId?: string;
  /** Custom-order draft to attach after initialize (requires design id first). */
  pendingCustomOrderDraft?: Record<string, unknown> | null;
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX' | string;
  publishTaskScope?: { ownerId?: string };
  kind?: PublishTaskKind;
  onComplete?: (result: {
    designId: string;
    payload: unknown;
  }) => void;
  onError?: (error: Error, designId?: string) => void;
};

const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clamp = (n: number) => Math.max(0, Math.min(100, n));

const isImageUploadFile = (file: File) =>
  file.type.trim().toLowerCase().startsWith('image/') ||
  /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name);

const isAlreadyUploadReady = (file: File, maxSizeBytes: number) => {
  if (!isImageUploadFile(file)) {
    return file.size <= maxSizeBytes;
  }
  const type = file.type.trim().toLowerCase();
  // Media-store already server-normalizes HEIC/unknown into JPEG at selection.
  // Re-running canvas preprocess on go-live is the multi-second mobile stall.
  if (file.size <= maxSizeBytes && /image\/(jpeg|png|webp|gif)/i.test(type)) {
    return true;
  }
  // .pre.jpg naming from preprocessImageFile / selection pipeline
  if (file.size <= maxSizeBytes && /\.pre\.(jpe?g|png)$/i.test(file.name)) {
    return true;
  }
  return false;
};

async function prepareFiles(
  files: DesignPublishJobInput['files'],
): Promise<Array<{ file: File; viewSlot: ReturnType<typeof normalizeMediaViewSlot> }>> {
  const maxSizeBytes = WEB_UPLOAD_POLICIES.designMedia.maxSizeBytes;
  const prepared = await Promise.all(
    files.map(async (item, index) => {
      const viewSlot = normalizeMediaViewSlot(item.viewSlot, index);
      const file = item.file;

      if (isAlreadyUploadReady(file, maxSizeBytes)) {
        return { file, viewSlot };
      }

      if (!isImageUploadFile(file)) {
        return { file, viewSlot };
      }

      let localFailureReason: 'preprocess-failed' | 'still-over-limit' | null = null;
      try {
        const processed = await preprocessImageFile(file, 'detail', { maxSizeBytes });
        if (processed.file.size <= maxSizeBytes) {
          return { file: processed.file, viewSlot };
        }
        localFailureReason = 'still-over-limit';
      } catch {
        localFailureReason = 'preprocess-failed';
      }

      const sniffed = await sniffImageFormat(file);
      if (
        !isUnreadableSniff(sniffed) &&
        (file.size > maxSizeBytes ||
          localFailureReason === 'still-over-limit' ||
          !isBrowserDisplayableSniff(sniffed))
      ) {
        try {
          const transcoded = await getNormalizedImageFile(file);
          if (transcoded.size <= maxSizeBytes) {
            return { file: transcoded, viewSlot };
          }
        } catch {
          /* keep original; assertValidUploadFiles will reject if oversize */
        }
      }

      return { file, viewSlot };
    }),
  );

  assertValidUploadFiles(
    prepared.map((p) => p.file),
    WEB_UPLOAD_POLICIES.designMedia,
  );
  return prepared;
}

function uploadPresigned(
  entry: PresignEntry,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!entry.uploadUrl) {
      reject(new Error(`Missing upload URL for ${file.name}`));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error('File upload failed'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`File upload failed with status ${xhr.status}`));
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
        Object.entries(entry.uploadFields).forEach(([k, v]) => form.append(k, v));
      }
      form.append('file', file, file.name);
      xhr.send(form);
      return;
    }
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

const activeJobs = new Map<string, AbortController>();

export function isDesignPublishJobRunning(taskId: string) {
  return activeJobs.has(taskId);
}

export async function runDesignPublishJob(input: DesignPublishJobInput): Promise<void> {
  if (activeJobs.has(input.taskId)) {
    addClientDiagnostic('warn', 'design-publish-job', 'Job already running', {
      taskId: input.taskId,
    });
    return;
  }

  const controller = new AbortController();
  activeJobs.set(input.taskId, controller);
  const scope = input.publishTaskScope ?? { ownerId: input.ownerId };
  const startedAt = Date.now();
  let designId: string | undefined = input.existingDesignId;

  // Throttle localStorage writes: S3 progress events can fire dozens of times
  // per second and each write re-renders Catalog via the subscribe event.
  let lastProgressWriteAt = 0;
  let lastWrittenProgress = -1;
  const setProgress = (
    progress: number,
    message: string,
    status: 'uploading' | 'finalizing' | 'published' | 'failed' = 'uploading',
  ) => {
    const next = clamp(progress);
    const now = Date.now();
    const isTerminal = status === 'published' || status === 'failed';
    const isMilestone =
      status === 'finalizing' ||
      next === 0 ||
      next >= 100 ||
      Math.abs(next - lastWrittenProgress) >= 3 ||
      now - lastProgressWriteAt >= 280;
    if (!isTerminal && !isMilestone) return;
    lastProgressWriteAt = now;
    lastWrittenProgress = next;
    updatePublishTask(
      input.taskId,
      {
        status,
        progress: next,
        message,
        designId,
        legacyCollectionId: designId,
        collectionId: designId,
      },
      scope,
    );
  };

  try {
    // Best-effort legal ack — never block the critical path more than necessary.
    // Failures are non-fatal here; backend still enforces policy on finalize.
    try {
      await DesignApi.acknowledgeContentPolicy();
    } catch (ackError) {
      addClientDiagnostic('warn', 'design-publish-job', 'Content policy ack failed', {
        error: ackError instanceof Error ? ackError.message : String(ackError),
      });
    }

    setProgress(5, 'Preparing…');

    if (input.existingDesignId) {
      // Edit-mode: metadata update + finalize publish only (media already remote
      // or handled by caller). Keep this path lean.
      designId = input.existingDesignId;
      setProgress(40, 'Updating…');
      await DesignApi.updateDesign(designId, {
        ...input.designMetadata,
        title: input.title,
        description: input.description,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        tags: input.tags,
      } as any);
      setProgress(80, 'Finishing…', 'finalizing');
      const finalized = await finalizeDesignUploads(designId, [], true, {
        action: 'publish',
        coverIndex: input.coverIndex,
        designMetadata: input.designMetadata,
      });
      setProgress(100, 'In review', 'published');
      input.onComplete?.({ designId, payload: finalized });
      window.setTimeout(() => removePublishTask(input.taskId, scope), 30_000);
      return;
    }

    const prepared = await prepareFiles(input.files);
    setProgress(12, 'Starting…');

    const initResp = await initializeDesignUploads({
      title: input.title,
      description: input.description,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      tags: input.tags,
      files: prepared.map(({ file, viewSlot }) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        viewSlot,
      })),
      draftOnly: Boolean(input.pendingCustomOrderDraft),
      ...input.designMetadata,
    });

    designId = resolveDesignId(initResp);
    if (!designId) {
      throw new Error('Server did not return a design id');
    }
    setProgress(20, 'Uploading…');

    const uploads = Array.isArray(initResp.uploads) ? initResp.uploads : [];
    if (prepared.length > 0 && uploads.length === 0) {
      throw new Error('Server did not return upload instructions');
    }

    const perFile: Record<string, number> = Object.fromEntries(
      uploads.map((u) => [u.fileId, 0]),
    );
    const reportAggregate = () => {
      const values = Object.values(perFile);
      const avg =
        values.length === 0
          ? 0
          : values.reduce((a, b) => a + b, 0) / values.length;
      // Map S3 progress into 20–88 so init/finalize have room on the bar.
      setProgress(20 + Math.round(avg * 0.68), 'Uploading…');
    };

    const completions: CompletionDto[] = [];
    await Promise.all(
      uploads.map(async (entry, index) => {
        const file = prepared[index]?.file;
        if (!file) throw new Error('Missing file for presign entry');
        let attempt = 0;
        while (attempt <= MAX_RETRY_ATTEMPTS) {
          try {
            await uploadPresigned(entry, file, (pct) => {
              perFile[entry.fileId] = pct;
              reportAggregate();
            });
            completions.push({
              fileId: entry.fileId,
              s3Key: entry.expectedKey,
              actualSize: file.size,
              actualMimeType: file.type,
              viewSlot: entry.viewSlot ?? prepared[index]?.viewSlot,
            });
            perFile[entry.fileId] = 100;
            reportAggregate();
            break;
          } catch (err) {
            attempt += 1;
            if (attempt > MAX_RETRY_ATTEMPTS) throw err;
            await sleep(RETRY_DELAY_MS * attempt);
          }
        }
      }),
    );

    // Custom-order: draft finalize already ran with draftOnly, then config, then publish.
    if (input.pendingCustomOrderDraft) {
      setProgress(90, 'Setup…', 'finalizing');
      // First finalize as draft to register media, then attach config, then publish.
      await finalizeDesignUploads(designId, completions, false, {
        action: 'draft',
        coverIndex: input.coverIndex,
        designMetadata: input.designMetadata,
      });
      const draft = input.pendingCustomOrderDraft as any;
      await customOrderConfigurationsApi.create({
        ...draft,
        fabricRuleBasisId:
          String(draft.fabricRuleBasisId ?? '').trim() ||
          (
            await customOrderConfigurationsApi.createFabricRuleBasis({
              label: `${input.title.trim() || 'Custom order'} fabric rules`,
              measurementKeys: draft.requiredMeasurementKeys,
              gender: (['MEN', 'WOMEN', 'UNISEX'].includes(
                String(input.measurementGender ?? '').toUpperCase(),
              )
                ? String(input.measurementGender).toUpperCase()
                : 'UNISEX') as 'MEN' | 'WOMEN' | 'UNISEX',
            })
          ).id,
        sourceId: designId,
      });
      setProgress(96, 'Finishing…', 'finalizing');
      const finalized = await finalizeDesignUploads(designId, [], true, {
        action: 'publish',
        coverIndex: input.coverIndex,
        designMetadata: input.designMetadata,
      });
      setProgress(100, 'In review', 'published');
      input.onComplete?.({ designId, payload: finalized });
    } else {
      setProgress(92, 'Finishing…', 'finalizing');
      // Single-shot publish finalize (media completions + publish).
      const finalized = await finalizeDesignUploads(designId, completions, true, {
        action: 'publish',
        coverIndex: input.coverIndex,
        designMetadata: input.designMetadata,
      });
      setProgress(100, 'In review', 'published');
      input.onComplete?.({ designId, payload: finalized });
    }

    addClientDiagnostic('info', 'design-publish-job', 'Publish job completed', {
      taskId: input.taskId,
      designId,
      durationMs: Date.now() - startedAt,
      fileCount: input.files.length,
    });
    window.setTimeout(() => removePublishTask(input.taskId, scope), 30_000);
  } catch (error) {
    const err =
      error instanceof Error ? error : new Error('Failed to go live with design');
    addClientDiagnostic('error', 'design-publish-job', 'Publish job failed', {
      taskId: input.taskId,
      designId,
      durationMs: Date.now() - startedAt,
      error: err.message,
    });
    updatePublishTask(
      input.taskId,
      {
        status: 'failed',
        progress: 100,
        designId,
        legacyCollectionId: designId,
        collectionId: designId,
        message: designId
          ? 'Setup issue — open editor to finish'
          : 'Go live failed',
        error: err.message,
      },
      scope,
    );
    input.onError?.(err, designId);
  } finally {
    activeJobs.delete(input.taskId);
  }
}

/** Force-unlock any modal scroll traps left after go-live navigation. */
export function unlockDocumentScroll() {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
}
