import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';

export type UploadLimits = Record<string, number>;
const UPLOAD_LIMITS_TTL_MS = 5 * 60 * 1000;
let uploadLimitsCache: { data: UploadLimits; expiresAt: number } | null = null;
let uploadLimitsPending: Promise<UploadLimits> | null = null;

export interface SystemConfigEntry {
  key: string;
  value: string;
  description?: string | null;
  updatedAt: string;
  updatedById?: string | null;
}

export const configApi = {
  /** Public: fetch upload limits (no auth required). */
  async getUploadLimits(options?: { forceRefresh?: boolean }): Promise<UploadLimits> {
    const forceRefresh = options?.forceRefresh === true;
    if (!forceRefresh && uploadLimitsCache && uploadLimitsCache.expiresAt > Date.now()) {
      return uploadLimitsCache.data;
    }
    if (!forceRefresh && uploadLimitsPending) {
      return uploadLimitsPending;
    }

    uploadLimitsPending = (async () => {
      const response = await apiClient.get('/config/upload-limits');
      const payload = unwrapApiResponse<UploadLimits>(response.data as any);
      const data = payload && typeof payload === 'object' ? (payload as UploadLimits) : {};
      uploadLimitsCache = { data, expiresAt: Date.now() + UPLOAD_LIMITS_TTL_MS };
      return data;
    })();

    try {
      return await uploadLimitsPending;
    } finally {
      uploadLimitsPending = null;
    }
  },

  /** Admin: list all system config entries. */
  async listSystemConfig(): Promise<SystemConfigEntry[]> {
    const response = await apiClient.get('/admin/system-config');
    const payload = unwrapApiResponse<SystemConfigEntry[] | { items?: SystemConfigEntry[] }>(
      response.data as any,
    );
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
      return payload.items;
    }
    return [];
  },

  /** Admin: get upload limits map. */
  async getAdminUploadLimits(): Promise<UploadLimits> {
    const response = await apiClient.get('/admin/system-config/upload-limits');
    const payload = unwrapApiResponse<UploadLimits>(response.data as any);
    return payload && typeof payload === 'object' ? (payload as UploadLimits) : {};
  },

  /** Admin: bulk update config entries. */
  async bulkUpdateConfig(entries: { key: string; value: string }[]): Promise<void> {
    await apiClient.patch('/admin/system-config', { entries });
  },
};
