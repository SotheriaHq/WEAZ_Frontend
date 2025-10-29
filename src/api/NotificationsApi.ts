import { apiClient } from './httpClient';

export class NotificationsApi {
  static async getUnreadCount(): Promise<{ count: number }> {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  }

  static async list(cursor?: string, limit?: number, type?: string) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (type) params.append('type', type);

    const response = await apiClient.get(`/notifications?${params.toString()}`);
    return response.data;
  }

  static async markAsRead(id: string): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  }

  static async markAllAsRead(): Promise<{ success: boolean; count: number }> {
    const response = await apiClient.post('/notifications/mark-all-read');
    return response.data;
  }
}