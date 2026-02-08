import { useState, useCallback, useRef } from 'react';
import {
  initializeCollectionUploads,
  finalizeCollectionUploads,
  type CompletionDto,
  type PresignEntry,
  type InitializeCollectionResponse,
} from '../api/collectionUploads';
import type { MediaItem } from '../types/media';

const MAX_PARALLEL_UPLOADS = 3;
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useCollectionUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [perFileProgress, setPerFileProgress] = useState<Record<string, number>>({});
  const activeRequests = useRef<Set<XMLHttpRequest>>(new Set());
  const cancelFlag = useRef(false);

  const uploadWithProgress = useCallback(
    (entry: PresignEntry, file: File, onProgress: (value: number) => void): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!entry.uploadUrl) {
          return reject(new Error('Missing upload URL for file ' + file.name));
        }
        if (cancelFlag.current) {
          return reject(new Error('Upload cancelled'));
        }
        const xhr = new XMLHttpRequest();
        activeRequests.current.add(xhr);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
        xhr.onerror = () => {
          activeRequests.current.delete(xhr);
          reject(new Error('File upload failed'));
        };
        xhr.onabort = () => {
          activeRequests.current.delete(xhr);
          reject(new Error('Upload cancelled'));
        };
        xhr.onload = () => {
          activeRequests.current.delete(xhr);
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(100);
            resolve();
          } else {
            reject(new Error('File upload failed with status ' + xhr.status));
          }
        };

        // Determine upload method: presigned POST if fields exist, else PUT
        const method = entry.method ?? (entry.uploadFields ? 'POST' : 'PUT');
        if (method === 'POST') {
          try {
            xhr.open('POST', entry.uploadUrl, true);
          } catch {
            activeRequests.current.delete(xhr);
            return reject(new Error(`Invalid upload URL: ${entry.uploadUrl}`));
          }
          const form = new FormData();
          if (entry.uploadFields) {
            Object.entries(entry.uploadFields).forEach(([key, value]) => {
              form.append(key, value);
            });
          }
          form.append('file', file, file.name);
          xhr.send(form);
        } else {
          try {
            xhr.open('PUT', entry.uploadUrl, true);
          } catch {
            activeRequests.current.delete(xhr);
            return reject(new Error(`Invalid upload URL: ${entry.uploadUrl}`));
          }
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        }
      }),
    [],
  );

  const uploadCollection = useCallback(
    async (
      items: MediaItem[], 
      title: string, 
      description?: string, 
      minPrice?: number,
      maxPrice?: number,
      isAvailableInStore?: boolean,
      tags?: string[],
      meta?: { categoryId?: string; type?: 'MALE' | 'FEMALE' | 'EVERYBODY'; visibility?: 'PUBLIC' | 'PRIVATE' },
      onProgress?: (value: number) => void,
      shouldPublish: boolean = true
    ) => {
      if (!items || items.length === 0) {
        throw new Error('No files to upload');
      }

      for (const item of items) {
        if (!item.file) {
          throw new Error('One or more selected items are missing a file. Please reselect and try again.');
        }
      }

      const normalizedTags = Array.isArray(tags)
        ? tags
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
            .map((tag) => tag.slice(0, 50))
        : [];

      // Allow saving drafts without tags when shouldPublish is false.
      if (shouldPublish && normalizedTags.length === 0) {
        throw new Error('Add at least one tag to describe this design.');
      }

      setIsUploading(true);
      setProgress(0);
      setError(null);
      cancelFlag.current = false;

      try {
        const filesPayload = items.map((item) => {
          const file = item.file!;
          return {
            name: file.name,
            type: file.type,
            size: file.size,
          };
        });

        // Initialize upload session
        // Initialize upload session (fallback to id if collectionId missing)
        const init = await initializeCollectionUploads({ 
          title, 
          description,
          minPrice,
          maxPrice,
          isAvailableInStore,
          tags: normalizedTags.slice(0, 20),
          files: filesPayload,
          categoryId: meta?.categoryId,
          type: meta?.type,
          visibility: meta?.visibility,
        }) as InitializeCollectionResponse & { id?: string };
        const collectionId = init.collectionId ?? init.id;
        if (!collectionId) {
          throw new Error('Upload session response is missing a design id.');
        }
        const uploads: PresignEntry[] = Array.isArray(init.uploads) ? init.uploads : ((init as unknown as Record<string, unknown>).uploads as PresignEntry[]) || [];

        // Map local media ids to the remote file ids returned by presign instructions
        const fileIdMap: Record<string, string> = {};

        // Pair each presign entry with its media item
        const queue = uploads.reduce<{ entry: PresignEntry; mediaItem: MediaItem }[]>(
          (
            accumulator: { entry: PresignEntry; mediaItem: MediaItem }[],
            entry: PresignEntry,
            index: number,
          ) => {
            const mediaItem = items.find((it) => it.id === entry.fileId) ?? items[index];
            if (mediaItem) {
              fileIdMap[mediaItem.id] = entry.fileId;
              accumulator.push({ entry, mediaItem });
            }
            return accumulator;
          },
          [],
        );

        if (queue.length === 0) {
          throw new Error('Server did not return any upload instructions for the selected files.');
        }

        const totalUploads = queue.length;
        // Initialize per-file progress map
        const initialProgressMap = queue.reduce<Record<string, number>>(
          (map: Record<string, number>, item: { entry: PresignEntry; mediaItem: MediaItem }) => {
            map[item.mediaItem.id] = 0;
            return map;
          },
          {},
        );
        setPerFileProgress(initialProgressMap);
        setProgress(0);
        onProgress?.(0);

        const updateFileProgress = (fileId: string, value: number) => {
          setPerFileProgress((previous) => {
            const next = { ...previous, [fileId]: Math.max(0, Math.min(100, value)) };
            const sum = Object.values(next).reduce((accumulator, current) => accumulator + current, 0);
            const aggregated = Math.round(sum / totalUploads);
            setProgress(aggregated);
            onProgress?.(aggregated);
            return next;
          });
        };

        const completions: CompletionDto[] = [];
        const pending = [...queue];

        const worker = async () => {
          while (pending.length > 0) {
            const next = pending.shift();
            if (!next) {
              return;
            }
            const { entry, mediaItem } = next;
            const file = mediaItem.file!;
            let attempt = 0;
            while (attempt <= MAX_RETRY_ATTEMPTS) {
              try {
                if (cancelFlag.current) {
                  throw new Error('Upload cancelled');
                }
                updateFileProgress(mediaItem.id, 0);
                await uploadWithProgress(entry, file, (value) => updateFileProgress(mediaItem.id, value));
                const completionId = entry.fileId ?? mediaItem.id;
                if (!completionId) {
                  throw new Error('Upload response missing file identifier.');
                }
                completions.push({
                  fileId: completionId,
                  s3Key: entry.expectedKey,
                  actualSize: file.size,
                  actualMimeType: file.type,
                });
                break;
              } catch (uploadError) {
                attempt += 1;
                if (attempt > MAX_RETRY_ATTEMPTS) {
                  throw uploadError instanceof Error ? uploadError : new Error('Upload failed');
                }
                await sleep(RETRY_DELAY_MS * attempt);
              }
            }
          }
        };

        const workers = Array.from({ length: Math.min(MAX_PARALLEL_UPLOADS, queue.length) }, () => worker());
        await Promise.all(workers);

        const finalizeResp = (await finalizeCollectionUploads(collectionId, completions, shouldPublish)) as
          | { data?: unknown }
          | unknown;
        const finalizeResponse = finalizeResp && typeof finalizeResp === 'object' && 'data' in finalizeResp
          ? (finalizeResp as { data?: unknown }).data
          : finalizeResp;
        setPerFileProgress({});
        setProgress(100);
        onProgress?.(100);
        const asObject =
          finalizeResponse && typeof finalizeResponse === 'object'
            ? (finalizeResponse as Record<string, unknown>)
            : { data: finalizeResponse };
        return { ...asObject, collectionId, completions, fileIdMap };
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Upload failed');
        setError(e);
        throw e;
      } finally {
        activeRequests.current.forEach((xhr) => {
          try {
            xhr.abort();
          } catch {}
        });
        activeRequests.current.clear();
        setIsUploading(false);
      }
    },
    [uploadWithProgress],
  );

  const cancelUploads = useCallback(() => {
    cancelFlag.current = true;
    activeRequests.current.forEach((xhr) => {
      try {
        xhr.abort();
      } catch {}
    });
    activeRequests.current.clear();
    setIsUploading(false);
    setProgress(0);
    setPerFileProgress({});
  }, []);

  return { uploadCollection, isUploading, progress, perFileProgress, error, cancelUploads } as const;
}

export default useCollectionUpload;
