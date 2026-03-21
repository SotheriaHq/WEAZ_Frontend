import { apiClient } from './httpClient';

export type UploadLimits = Record<string, number>;

export interface SystemConfigEntry {
  key: string;
  value: string;
  description?: string | null;
  updatedAt: string;
  updatedById?: string | null;
}

export const configApi = {
  /** Public: fetch upload limits (no auth required). */
  async getUploadLimits(): Promise<UploadLimits> {
    const response = await apiClient.get('/config/upload-limits');
    return response.data as UploadLimits;
  },

  /** Admin: list all system config entries. */
  async listSystemConfig(): Promise<SystemConfigEntry[]> {
    const response = await apiClient.get('/admin/system-config');
    return response.data as SystemConfigEntry[];
  },

  /** Admin: get upload limits map. */
  async getAdminUploadLimits(): Promise<UploadLimits> {
    const response = await apiClient.get('/admin/system-config/upload-limits');
    return response.data as UploadLimits;
  },

  /** Admin: bulk update config entries. */
  async bulkUpdateConfig(entries: { key: string; value: string }[]): Promise<void> {
    await apiClient.patch('/admin/system-config', { entries });
  },
};
