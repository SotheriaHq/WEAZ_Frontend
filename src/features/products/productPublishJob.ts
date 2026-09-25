/**
 * Module-level product publish job.
 *
 * Mirrors `designPublishJob`: it survives the EditProduct form unmounting after
 * the immediate "Create Product" navigation, so the create → media-upload →
 * publish pipeline runs to completion (and keeps the store filler card's
 * progress up to date) even though the form component is gone. Holding the File
 * blobs outside React lifecycle is what makes the instant-reroute UX safe on
 * mobile browsers.
 */
import { productApi, type ProductCreateDto } from '@/api/ProductApi';
import {
  customOrderConfigurationsApi,
  type CustomOrderConfigurationUpsertInput,
} from '@/api/CustomOrderApi';
import { updateStorePolicies } from '@/api/StoreApi';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';
import { emitProductStudioSync } from '@/utils/productStudioEvents';
import { updatePublishTask, removePublishTask } from '@/utils/publishTracker';
import {
  toBackendMediaViewSlot,
  type MediaViewSlot,
} from '@/utils/contentIntegrity';

export type ProductPublishUpload = {
  file: File;
  isPrimary: boolean;
  viewSlot: MediaViewSlot;
};

export type ProductPublishJobInput = {
  taskId: string;
  ownerId?: string;
  title: string;
  /** Fully-built product payload from the form (all validation already ran). */
  payload: ProductCreateDto;
  /** The status the product should end on ('ACTIVE' to go live, 'DRAFT', …). */
  finalStatus: ProductCreateDto['status'];
  pendingUploads: ProductPublishUpload[];
  /**
   * Resume into a product that was already created by a previous attempt.
   *
   * The job creates the product FIRST and uploads media after, so a failed
   * upload leaves a real, media-less product behind. Re-running from scratch
   * would create a duplicate; this lets a retry pick up exactly where it
   * stopped, using the File blobs still held in `retryableInputs`.
   */
  existingProductId?: string | null;
  pendingCustomOrderDraft?: Omit<
    CustomOrderConfigurationUpsertInput,
    'sourceId'
  > | null;
  /** Store shipping regions to persist first (only when they changed). */
  shippingRegionsToPersist?: string[] | null;
  acknowledgeContentPolicy?: boolean;
  publishTaskScope?: { ownerId?: string };
  onComplete?: (result: { productId: string; payload: unknown }) => void;
  onError?: (error: Error, productId?: string) => void;
};

const activeJobs = new Set<string>();
// Snapshots kept so a FAILED job can be retried from the store panel after the
// origin form unmounted — the File blobs only live here in memory.
const retryableInputs = new Map<string, ProductPublishJobInput>();

export function isProductPublishJobRunning(taskId: string): boolean {
  return activeJobs.has(taskId);
}
export function getRetryableProductPublishJob(
  taskId: string,
): ProductPublishJobInput | undefined {
  return retryableInputs.get(taskId);
}
export function clearRetryableProductPublishJob(taskId: string): void {
  retryableInputs.delete(taskId);
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

async function resolveDraftWithBasis(
  draft: Omit<CustomOrderConfigurationUpsertInput, 'sourceId'>,
  productTitle: string,
): Promise<Omit<CustomOrderConfigurationUpsertInput, 'sourceId'>> {
  const basisId = String(draft.fabricRuleBasisId ?? '').trim();
  if (basisId) return { ...draft, fabricRuleBasisId: basisId };
  const hiddenBasis = await customOrderConfigurationsApi.createFabricRuleBasis({
    label: `${productTitle.trim() || 'Product'} fabric rules`,
    measurementKeys: draft.requiredMeasurementKeys,
  });
  return { ...draft, fabricRuleBasisId: hiddenBasis.id };
}

export async function runProductPublishJob(
  input: ProductPublishJobInput,
): Promise<void> {
  if (activeJobs.has(input.taskId)) {
    addClientDiagnostic('warn', 'product-publish-job', 'Job already running', {
      taskId: input.taskId,
    });
    return;
  }
  activeJobs.add(input.taskId);
  retryableInputs.delete(input.taskId);

  const scope = input.publishTaskScope ?? { ownerId: input.ownerId };
  const startedAt = Date.now();
  let productId: string | undefined;

  let lastWriteAt = 0;
  const setProgress = (
    progress: number,
    message: string,
    status: 'uploading' | 'finalizing' | 'published' | 'failed' = 'uploading',
  ) => {
    const next = clamp(progress);
    const now = Date.now();
    const terminal = status === 'published' || status === 'failed';
    // Throttle intermediate writes — each write re-renders the store panel.
    if (!terminal && status !== 'finalizing' && next < 100 && now - lastWriteAt < 220) {
      return;
    }
    lastWriteAt = now;
    updatePublishTask(
      input.taskId,
      {
        status,
        progress: next,
        message,
        designId: productId,
        legacyCollectionId: productId,
        collectionId: productId,
      },
      scope,
    );
  };

  const finalStatus = input.finalStatus ?? 'ACTIVE';
  const hasUploads = input.pendingUploads.length > 0;
  // With media + a go-live intent, create as DRAFT first so the product exists
  // to attach the uploads to, then flip to the final status (matches the
  // original inline create flow).
  const createAsDraftForUploads = hasUploads && finalStatus === 'ACTIVE';

  try {
    if (input.acknowledgeContentPolicy) {
      try {
        await productApi.acknowledgeContentPolicy();
      } catch (ackError) {
        addClientDiagnostic('warn', 'product-publish-job', 'Content policy ack failed', {
          error: ackError instanceof Error ? ackError.message : String(ackError),
        });
      }
    }
    if (input.shippingRegionsToPersist && input.shippingRegionsToPersist.length) {
      try {
        await updateStorePolicies({
          shippingRegions: input.shippingRegionsToPersist,
        });
      } catch (policyError) {
        addClientDiagnostic('warn', 'product-publish-job', 'Shipping policy persist failed', {
          error:
            policyError instanceof Error
              ? policyError.message
              : String(policyError),
        });
      }
    }

    let created: { id: string };
    if (input.existingProductId) {
      // Resuming: the product exists, only its media never landed.
      created = { id: input.existingProductId };
      productId = input.existingProductId;
      setProgress(20, 'Uploading…');
    } else {
      setProgress(8, 'Creating…');
      created = await productApi.createProduct(
        createAsDraftForUploads
          ? { ...input.payload, status: 'DRAFT' }
          : input.payload,
      );
      productId = created.id;
      setProgress(20, 'Uploading…');
    }

    const uploadedMediaIds: string[] = [];
    for (let i = 0; i < input.pendingUploads.length; i += 1) {
      const upload = input.pendingUploads[i];
      /*
       * One retry per file before giving up on the whole submission.
       *
       * The product row is already created by this point, so a single dropped
       * request — a flaky connection mid-upload is the common case on mobile —
       * used to abandon the job at whatever percentage it had reached and leave
       * a media-less product behind. Retrying the individual file costs one
       * request and resolves the overwhelmingly common cause.
       */
      let result: { id: string };
      try {
        result = await productApi.uploadProductMedia(
          created.id,
          upload.file,
          upload.isPrimary,
          upload.viewSlot,
        );
      } catch (uploadError) {
        addClientDiagnostic('warn', 'product-publish-job', 'Media upload retrying', {
          taskId: input.taskId,
          productId: created.id,
          fileIndex: i,
          error: uploadError instanceof Error ? uploadError.message : 'unknown',
        });
        result = await productApi.uploadProductMedia(
          created.id,
          upload.file,
          upload.isPrimary,
          upload.viewSlot,
        );
      }
      uploadedMediaIds.push(result.id);
      setProgress(
        20 + Math.round(((i + 1) / input.pendingUploads.length) * 60),
        'Uploading…',
      );
    }

    if (input.pendingCustomOrderDraft) {
      setProgress(84, 'Setting up…', 'finalizing');
      const draftWithBasis = await resolveDraftWithBasis(
        input.pendingCustomOrderDraft,
        input.title,
      );
      await customOrderConfigurationsApi.create({
        ...draftWithBasis,
        sourceId: created.id,
      });
    }

    if (createAsDraftForUploads) {
      setProgress(92, 'Publishing…', 'finalizing');
      const media = uploadedMediaIds.map((fileUploadId, index) => ({
        fileUploadId,
        viewSlot: toBackendMediaViewSlot(
          input.pendingUploads[index]?.viewSlot,
          index,
        ),
        orderIndex: index,
      }));
      await productApi.updateProduct(created.id, {
        ...input.payload,
        status: finalStatus,
        media,
      } as Partial<ProductCreateDto>);
    }

    setProgress(100, 'In review', 'published');
    // Tell the store panel to pull the freshly-created product into the list.
    emitProductStudioSync({ productId: created.id, reason: 'product-created' });
    input.onComplete?.({ productId: created.id, payload: created });
    addClientDiagnostic('info', 'product-publish-job', 'Publish job completed', {
      taskId: input.taskId,
      productId,
      durationMs: Date.now() - startedAt,
      fileCount: input.pendingUploads.length,
    });
    window.setTimeout(() => removePublishTask(input.taskId, scope), 30_000);
  } catch (error) {
    const err =
      error instanceof Error ? error : new Error('Failed to create product');
    addClientDiagnostic('error', 'product-publish-job', 'Publish job failed', {
      taskId: input.taskId,
      productId,
      durationMs: Date.now() - startedAt,
      error: err.message,
    });
    // Retain the snapshot so the store panel's Retry can re-run the exact job.
    retryableInputs.set(input.taskId, input);
    updatePublishTask(
      input.taskId,
      {
        status: 'failed',
        progress: 100,
        designId: productId,
        legacyCollectionId: productId,
        collectionId: productId,
        /*
         * Say what went wrong. "Upload didn't finish" is true of every failure
         * here and actionable for none of them; the server's reason ("already
         * has a FRONT view", "up to 6 images") is the one a brand can act on.
         */
        message: productId
          ? `Upload didn't finish — ${err.message}`
          : `Create failed — ${err.message}`,
        error: err.message,
      },
      scope,
    );
    input.onError?.(err, productId);
  } finally {
    activeJobs.delete(input.taskId);
  }
}
