import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';

export interface MessagingCursor {
  createdAt: string;
  id: string;
}

export interface MessageAttachment {
  id: string;
  kind: 'IMAGE' | 'DOCUMENT';
  file: {
    id: string;
    s3Url: string;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  };
}

export interface UploadedMessageFile {
  id: string;
  url: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  senderUserId?: string | null;
  senderRole: 'BUYER' | 'BRAND_OWNER' | 'ADMIN' | 'SYSTEM';
  kind: 'USER' | 'SYSTEM' | 'MODERATION_NOTICE';
  visibilityState: 'VISIBLE' | 'HIDDEN' | 'REDACTED';
  bodyText?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
  } | null;
  attachments: MessageAttachment[];
}

export interface MessageListResponse {
  items: ThreadMessage[];
  hasNextPage: boolean;
  endCursor: MessagingCursor | null;
}

export interface ThreadSummaryResponse {
  id: string;
  status: 'OPEN' | 'READ_ONLY' | 'ARCHIVED' | 'BLOCKED';
  hasUnread: boolean;
  unreadCount?: number;
  responseRequired: boolean;
  lastMessageAt?: string | null;
}

export interface ThreadSummaryByContextItem {
  contextId: string;
  summary: ThreadSummaryResponse | null;
}

export interface ThreadSummaryByContextResponse {
  items: ThreadSummaryByContextItem[];
}

const parseMessageList = (data: unknown): MessageListResponse => {
  const payload = unwrapApiResponse<any>(data);
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    hasNextPage: Boolean(payload?.hasNextPage),
    endCursor: payload?.endCursor ?? null,
  };
};

export const messagingApi = {
  async uploadMessageAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const isDocument = file.type === 'application/pdf';
    const endpoint = isDocument ? '/uploads/message-document' : '/uploads/message-image';
    const response = await apiClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data as UploadedMessageFile;
  },

  async listCustomOrderMessages(orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/custom-orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async listCustomOrderMessagesForBrand(brandId: string, orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/brands/${brandId}/custom-orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async listAdminCustomOrderMessages(orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/admin/messaging/custom-orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async listAdminOrderMessages(orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/admin/messaging/orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async sendCustomOrderMessage(orderId: string, payload: { bodyText?: string; clientMessageId: string; attachmentFileIds?: string[] }) {
    const response = await apiClient.post(
      `/custom-orders/${orderId}/messages`,
      payload,
      { headers: { 'Idempotency-Key': payload.clientMessageId } },
    );

    return unwrapApiResponse<any>(response.data);
  },

  async sendCustomOrderMessageForBrand(brandId: string, orderId: string, payload: { bodyText?: string; clientMessageId: string; attachmentFileIds?: string[] }) {
    const response = await apiClient.post(
      `/brands/${brandId}/custom-orders/${orderId}/messages`,
      payload,
      { headers: { 'Idempotency-Key': payload.clientMessageId } },
    );

    return unwrapApiResponse<any>(response.data);
  },

  async markCustomOrderRead(orderId: string, upToMessageId?: string) {
    const response = await apiClient.post(`/custom-orders/${orderId}/messages/read`, {
      upToMessageId,
    });

    return unwrapApiResponse<{ success: boolean; threadId?: string | null }>(response.data);
  },

  async markCustomOrderReadForBrand(brandId: string, orderId: string, upToMessageId?: string) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/messages/read`, {
      upToMessageId,
    });

    return unwrapApiResponse<{ success: boolean; threadId?: string | null }>(response.data);
  },

  async getCustomOrderSummary(orderId: string, includeUnreadCount = true) {
    const response = await apiClient.get(`/custom-orders/${orderId}/messages/summary`, {
      params: {
        includeUnreadCount: includeUnreadCount ? 'true' : 'false',
      },
    });

    return unwrapApiResponse<ThreadSummaryResponse | null>(response.data);
  },

  async getBulkCustomOrderSummaries(orderIds: string[], includeUnreadCount = true) {
    const response = await apiClient.post('/custom-orders/messages/summaries', {
      contextIds: orderIds,
      includeUnreadCount: includeUnreadCount ? 'true' : 'false',
    });

    return unwrapApiResponse<ThreadSummaryByContextResponse>(response.data);
  },

  async getCustomOrderSummaryForBrand(brandId: string, orderId: string, includeUnreadCount = true) {
    const response = await apiClient.get(`/brands/${brandId}/custom-orders/${orderId}/messages/summary`, {
      params: {
        includeUnreadCount: includeUnreadCount ? 'true' : 'false',
      },
    });

    return unwrapApiResponse<ThreadSummaryResponse | null>(response.data);
  },

  async getBulkCustomOrderSummariesForBrand(brandId: string, orderIds: string[], includeUnreadCount = true) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/messages/summaries`, {
      contextIds: orderIds,
      includeUnreadCount: includeUnreadCount ? 'true' : 'false',
    });

    return unwrapApiResponse<ThreadSummaryByContextResponse>(response.data);
  },

  async listOrderMessages(orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async listOrderMessagesForBrand(brandId: string, orderId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/brands/${brandId}/orders/${orderId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async sendOrderMessage(orderId: string, payload: { bodyText?: string; clientMessageId: string; attachmentFileIds?: string[] }) {
    const response = await apiClient.post(
      `/orders/${orderId}/messages`,
      payload,
      { headers: { 'Idempotency-Key': payload.clientMessageId } },
    );

    return unwrapApiResponse<any>(response.data);
  },

  async sendOrderMessageForBrand(brandId: string, orderId: string, payload: { bodyText?: string; clientMessageId: string; attachmentFileIds?: string[] }) {
    const response = await apiClient.post(
      `/brands/${brandId}/orders/${orderId}/messages`,
      payload,
      { headers: { 'Idempotency-Key': payload.clientMessageId } },
    );

    return unwrapApiResponse<any>(response.data);
  },

  async markOrderRead(orderId: string, upToMessageId?: string) {
    const response = await apiClient.post(`/orders/${orderId}/messages/read`, {
      upToMessageId,
    });

    return unwrapApiResponse<{ success: boolean; threadId?: string | null }>(response.data);
  },

  async markOrderReadForBrand(brandId: string, orderId: string, upToMessageId?: string) {
    const response = await apiClient.post(`/brands/${brandId}/orders/${orderId}/messages/read`, {
      upToMessageId,
    });

    return unwrapApiResponse<{ success: boolean; threadId?: string | null }>(response.data);
  },

  async getOrderSummary(orderId: string, includeUnreadCount = true) {
    const response = await apiClient.get(`/orders/${orderId}/messages/summary`, {
      params: {
        includeUnreadCount: includeUnreadCount ? 'true' : 'false',
      },
    });

    return unwrapApiResponse<ThreadSummaryResponse | null>(response.data);
  },

  async getBulkOrderSummaries(orderIds: string[], includeUnreadCount = true) {
    const response = await apiClient.post('/orders/messages/summaries', {
      contextIds: orderIds,
      includeUnreadCount: includeUnreadCount ? 'true' : 'false',
    });

    return unwrapApiResponse<ThreadSummaryByContextResponse>(response.data);
  },

  async getOrderSummaryForBrand(brandId: string, orderId: string, includeUnreadCount = true) {
    const response = await apiClient.get(`/brands/${brandId}/orders/${orderId}/messages/summary`, {
      params: {
        includeUnreadCount: includeUnreadCount ? 'true' : 'false',
      },
    });

    return unwrapApiResponse<ThreadSummaryResponse | null>(response.data);
  },

  async getBulkOrderSummariesForBrand(brandId: string, orderIds: string[], includeUnreadCount = true) {
    const response = await apiClient.post(`/brands/${brandId}/orders/messages/summaries`, {
      contextIds: orderIds,
      includeUnreadCount: includeUnreadCount ? 'true' : 'false',
    });

    return unwrapApiResponse<ThreadSummaryByContextResponse>(response.data);
  },
};
