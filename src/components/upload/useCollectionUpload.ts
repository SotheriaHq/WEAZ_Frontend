import { useState, useCallback } from 'react';
import { apiClient } from '../../api/httpClient';

type PresignEntry = {
  fileId: string;
  expectedKey: string;
  uploadUrl: string;
  uploadFields?: Record<string, string> | null;
  method: 'POST' | 'PUT';
};

type InitializeResp = {
  collectionId: string;
  uploads: PresignEntry[];
  expiresIn?: number;
};

type CompleteDto = {
  fileId: string;
  s3Key: string;
  actualSize: number;
  actualMimeType: string;
};

export function useCollectionUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadCollection = useCallback(async (
    files: File[],
    title: string,
    description?: string,
    opts?: {
      visibility?: 'PUBLIC' | 'PRIVATE';
      categoryId?: string;
      subCategoryId?: string;
      categoryTypeId?: string;
      type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
    }
  ) => {
    if (!files || files.length === 0) throw new Error('No files');
    setIsUploading(true);
    setProgress(0);

    // Step 1: initialize and get presigned upload instructions
    const dto: any = {
      title,
      description,
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    };
    if (opts?.visibility) (dto as any).visibility = opts.visibility;
    if (opts?.categoryId) (dto as any).categoryId = opts.categoryId;
    if (opts?.subCategoryId) {
      (dto as any).subCategoryId = opts.subCategoryId;
      (dto as any).categoryTypeId = opts.subCategoryId;
    } else if (opts?.categoryTypeId) {
      (dto as any).subCategoryId = opts.categoryTypeId;
      (dto as any).categoryTypeId = opts.categoryTypeId;
    }
    if (opts?.type) (dto as any).type = opts.type;

    const initResp = await apiClient.post('/collections/initialize', dto);
    const initJson = initResp.data as InitializeResp;

    const uploads = Array.isArray(initJson.uploads) ? initJson.uploads : [];
    const results: CompleteDto[] = [];

    // Step 2: upload files to S3 according to presign entries
    for (let i = 0; i < uploads.length; i++) {
      const presign = uploads[i];
      const file = files[i];
      if (!file) throw new Error('Missing file for presign entry');

      if (presign.method === 'POST') {
        const form = new FormData();
        if (presign.uploadFields) {
          for (const [k, v] of Object.entries(presign.uploadFields)) form.append(k, v as string);
        }
        form.append('file', file, file.name);

        const res = await fetch(presign.uploadUrl, { method: 'POST', body: form });
        if (!res.ok) throw new Error('Upload to S3 failed');
      } else if (presign.method === 'PUT') {
        const res = await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        if (!res.ok) throw new Error('Upload to S3 failed');
      } else {
        throw new Error('Unsupported presign method');
      }

      results.push({ fileId: presign.fileId, s3Key: presign.expectedKey, actualSize: file.size, actualMimeType: file.type });
      setProgress(Math.round(((i + 1) / uploads.length) * 100));
    }

    // Step 3: finalize
    const finalizeResp = await apiClient.post(`/collections/${initJson.collectionId}/finalize`, { completions: results });
    setIsUploading(false);
    setProgress(100);
    return finalizeResp.data;
  }, []);

  return { uploadCollection, isUploading, progress } as const;
}

export default useCollectionUpload;
