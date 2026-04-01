import { apiClient } from './httpClient';

export class NotificationsApi {
  static async getUnreadCount(): Promise<{ count: number }> {
    const response = await apiClient.get('/notifications/unread-count');
    const payload = response.data;
    return (payload?.data ?? payload) as { count: number };
  }

  static async list(cursor?: string, limit?: number, type?: string) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (type) params.append('type', type);

    const response = await apiClient.get(`/notifications?${params.toString()}`);
    const payload = response.data;
    return payload?.data ?? payload;
  }

  static async markAsRead(id: string): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    const payload = response.data;
    return (payload?.data ?? payload) as { success: boolean };
  }

  static async markAllAsRead(): Promise<{ success: boolean; count: number }> {
    const response = await apiClient.post('/notifications/mark-all-read');
    const payload = response.data;
    return (payload?.data ?? payload) as { success: boolean; count: number };
  }

  static async delete(id: string): Promise<{ success: boolean; id: string }> {
    const response = await apiClient.delete(`/notifications/${id}`);
    const payload = response.data;
    return (payload?.data ?? payload) as { success: boolean; id: string };
  }

  static async getSettings(): Promise<any> {
    const response = await apiClient.get('/notifications/settings');
    return response.data?.data ?? response.data;
  }

  static async updateSettings(settings: any): Promise<any> {
    const response = await apiClient.patch('/notifications/settings', settings);
    return response.data?.data ?? response.data;
  }

  static async getEmailSettings(): Promise<any> {
    const response = await apiClient.get('/notifications/email-settings');
    return response.data?.data ?? response.data;
  }

  static async updateEmailSettings(settings: any): Promise<any> {
    const response = await apiClient.patch('/notifications/email-settings', settings);
    return response.data?.data ?? response.data;
  }

  static async resetEmailSettings(): Promise<any> {
    const response = await apiClient.post('/notifications/email-settings/reset-defaults');
    return response.data?.data ?? response.data;
  }

  static async listTrustedDevices(): Promise<any> {
    const response = await apiClient.get('/auth/security/devices');
    return response.data?.data ?? response.data;
  }

  static async revokeTrustedDevice(deviceId: string): Promise<any> {
    const response = await apiClient.patch(`/auth/security/devices/${deviceId}/revoke`);
    return response.data?.data ?? response.data;
  }
}
