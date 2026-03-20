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
  mutedUntil?: string | null;
  archivedAt?: string | null;
  isMuted?: boolean;
  isArchivedByActor?: boolean;
}

export interface ThreadSummaryByContextItem {
  contextId: string;
  summary: ThreadSummaryResponse | null;
}

export interface ThreadSummaryByContextResponse {
  items: ThreadSummaryByContextItem[];
}

export interface InboxItem {
  threadId: string;
  contextType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';
  orderId?: string | null;
  customOrderId?: string | null;
  inquiryId?: string | null;
  title: string;
  subtitle: string;
  participant?: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
  } | null;
  lastMessageAt?: string | null;
  createdAt: string;
  unreadCount: number;
  hasUnread: boolean;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  targetUrl?: string;
}

export interface InboxResponse {
  items: InboxItem[];
  hasNextPage: boolean;
  endCursor: { cursorLastMessageAt: string; cursorThreadId: string } | null;
}

export interface ResolvedThreadRoute {
  threadId: string;
  contextType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';
  orderId?: string | null;
  customOrderId?: string | null;
  inquiryType?: string;
  targetUrl: string;
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

  async updateOrderThreadPreferences(
    orderId: string,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) {
    const response = await apiClient.post(`/orders/${orderId}/messages/preferences`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async updateOrderThreadPreferencesForBrand(
    brandId: string,
    orderId: string,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) {
    const response = await apiClient.post(`/brands/${brandId}/orders/${orderId}/messages/preferences`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async updateCustomOrderThreadPreferences(
    orderId: string,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) {
    const response = await apiClient.post(`/custom-orders/${orderId}/messages/preferences`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async updateCustomOrderThreadPreferencesForBrand(
    brandId: string,
    orderId: string,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/messages/preferences`, payload);
    return unwrapApiResponse<any>(response.data);
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

  async requestOrderExtensionForBrand(
    brandId: string,
    orderId: string,
    payload: { requestedExtraDays: number; reason: string },
  ) {
    const response = await apiClient.post(`/brands/${brandId}/orders/${orderId}/messages/extension-requests`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async respondToOrderExtension(
    orderId: string,
    requestMessageId: string,
    payload: { response: 'ACCEPTED' | 'REJECTED' | 'COUNTERED'; counterDays?: number; note?: string },
  ) {
    const response = await apiClient.post(
      `/orders/${orderId}/messages/extension-requests/${requestMessageId}/respond`,
      payload,
    );
    return unwrapApiResponse<any>(response.data);
  },

  async openOrderDispute(orderId: string, payload: { description: string }) {
    const response = await apiClient.post(`/orders/${orderId}/messages/disputes`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async openOrderDisputeForBrand(brandId: string, orderId: string, payload: { description: string }) {
    const response = await apiClient.post(`/brands/${brandId}/orders/${orderId}/messages/disputes`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async requestCustomOrderExtensionForBrand(
    brandId: string,
    orderId: string,
    payload: { targetType: 'PRODUCTION' | 'DELIVERY' | 'BOTH'; requestedExtraDays: number; reason: string },
  ) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/messages/extension-requests`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async respondToCustomOrderExtension(
    orderId: string,
    requestId: string,
    payload: { response: 'ACCEPTED' | 'REJECTED' | 'COUNTERED'; counterDays?: number },
  ) {
    const response = await apiClient.post(`/custom-orders/${orderId}/messages/extension-requests/${requestId}/respond`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async openCustomOrderDispute(
    orderId: string,
    payload: { issueType: 'WRONG_ITEM' | 'MATERIAL_DEFECT' | 'MEASUREMENT_NON_COMPLIANCE' | 'UNFINISHED_WORK' | 'NON_DELIVERY' | 'UNREASONABLE_DELAY' | 'OTHER'; description: string; evidenceJson?: Record<string, unknown> },
  ) {
    const response = await apiClient.post(`/custom-orders/${orderId}/messages/disputes`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async openCustomOrderDisputeForBrand(
    brandId: string,
    orderId: string,
    payload: { issueType: 'WRONG_ITEM' | 'MATERIAL_DEFECT' | 'MEASUREMENT_NON_COMPLIANCE' | 'UNFINISHED_WORK' | 'NON_DELIVERY' | 'UNREASONABLE_DELAY' | 'OTHER'; description: string; evidenceJson?: Record<string, unknown> },
  ) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/messages/disputes`, payload);
    return unwrapApiResponse<any>(response.data);
  },

  async getInbox(params?: {
    cursorLastMessageAt?: string;
    cursorThreadId?: string;
    limit?: number;
    filter?: 'all' | 'unread' | 'archived';
    contextType?: 'all' | 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';
    q?: string;
  }) {
    const response = await apiClient.get('/messaging/inbox', { params });
    return unwrapApiResponse<InboxResponse>(response.data);
  },

  async resolveThreadRoute(threadId: string) {
    const response = await apiClient.get(`/messaging/threads/${threadId}/resolve`);
    return unwrapApiResponse<ResolvedThreadRoute>(response.data);
  },

  async listThreadMessages(threadId: string, params?: { cursorCreatedAt?: string; cursorId?: string; limit?: number }) {
    const response = await apiClient.get(`/messaging/threads/${threadId}/messages`, { params });
    return parseMessageList(response.data);
  },

  async sendThreadMessage(threadId: string, payload: { bodyText?: string; clientMessageId: string; attachmentFileIds?: string[] }) {
    const response = await apiClient.post(
      `/messaging/threads/${threadId}/messages`,
      payload,
      { headers: { 'Idempotency-Key': payload.clientMessageId } },
    );
    return unwrapApiResponse<any>(response.data);
  },

  async markThreadReadById(threadId: string, upToMessageId?: string) {
    const response = await apiClient.post(`/messaging/threads/${threadId}/read`, {
      upToMessageId,
    });
    return unwrapApiResponse<{ success: boolean; threadId?: string | null }>(response.data);
  },
};
