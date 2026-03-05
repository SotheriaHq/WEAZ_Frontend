import { apiClient } from './httpClient';
import type {
  AdminUser,
  AdminBrand,
  AdminProduct,
  AdminCollection,
  AdminPayout,
  AdminDispute,
  AdminAuditLog,
  AdminSlaConfig,
  FeatureFlag,
  NotificationTemplate,
  AdminCategory,
  AdminTagItem,
} from '../types/admin';

type Paginated<T> = { items: T[]; nextCursor?: string };

// ── Users ──
export const adminUsersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AdminUser[]>('/admin/users', { params }),
  getById: (id: string) =>
    apiClient.get<AdminUser>(`/admin/users/${id}`),
  create: (data: { email: string; firstName: string; lastName: string; tempPassword: string }) =>
    apiClient.post<AdminUser>('/admin/users', data),
  updateRole: (id: string, role: string) =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),
  updatePermissions: (id: string, permissions: string[]) =>
    apiClient.patch(`/admin/users/${id}/permissions`, { permissions }),
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/admin/users/${id}/status`, { status, reason }),
  forcePasswordReset: (id: string) =>
    apiClient.post(`/admin/users/${id}/force-password-reset`),
};

// ── Brands ──
export const adminBrandsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminBrand>>('/admin/brands', { params }),
  getById: (id: string) =>
    apiClient.get<AdminBrand>(`/admin/brands/${id}`),
  overrideStoreOpen: (id: string, isOpen: boolean) =>
    apiClient.patch(`/admin/brands/${id}/open-close`, { isStoreOpen: isOpen }),
  suspend: (id: string, reason: string) =>
    apiClient.patch(`/admin/brands/${id}/suspend`, { reason }),
};

// ── Products ──
export const adminProductsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminProduct>>('/admin/products', { params }),
  moderate: (id: string, data: { isActive?: boolean; isFeatured?: boolean }) =>
    apiClient.patch(`/admin/products/${id}/moderate`, data),
};

// ── Collections ──
export const adminCollectionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminCollection>>('/admin/collections', { params }),
  moderate: (id: string, data: { status?: string; visibility?: 'PUBLIC' | 'PRIVATE' }) =>
    apiClient.patch(`/admin/collections/${id}/moderate`, data),
};

// ── Taxonomy ──
export const adminTaxonomyApi = {
  listCategories: () => apiClient.get<AdminCategory[]>('/admin/categories'),
};

// ── Tags ──
export const adminTagsApi = {
  list: (limit = 100) => apiClient.get<AdminTagItem[]>('/tags', { params: { limit } }),
  search: (q: string, limit = 20) => apiClient.get<{ items: AdminTagItem[] }>('/tags/search', { params: { q, limit } }),
};

// ── Payouts ──
export const adminPayoutsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AdminPayout[] | Paginated<AdminPayout>>('/admin/payouts', { params }),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/admin/payouts/${id}/status`, { status }),
};

// ── Disputes ──
export const adminDisputesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminDispute>>('/admin/disputes', { params }),
  create: (data: { type: string; reporterId: string; targetType: string; targetId: string; description: string }) =>
    apiClient.post<AdminDispute>('/admin/disputes', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/disputes/${id}`, data),
  reopen: (id: string, reason: string) =>
    apiClient.post(`/admin/disputes/${id}/reopen`, { reason }),
};

// ── Moderation ──
export const adminModerationApi = {
  getQueue: () =>
    apiClient.get('/admin/moderation/queue'),
  reviewItem: (id: string, data: { action: string; reason?: string }) =>
    apiClient.patch(`/admin/moderation/items/${id}`, data),
};

// ── Audit Logs ──
export const adminAuditApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminAuditLog>>('/admin/audit-logs', { params }),
};

// ── SLA Config ──
export const adminSlaApi = {
  list: () =>
    apiClient.get<AdminSlaConfig[]>('/admin/sla-config'),
  create: (data: { area: string; targetHours: number; startDate?: string; endDate?: string }) =>
    apiClient.post<AdminSlaConfig>('/admin/sla-config', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/sla-config/${id}`, data),
  delete: (id: string) =>
    apiClient.delete(`/admin/sla-config/${id}`),
};

// ── Feature Flags ──
export const adminFeatureFlagsApi = {
  list: () =>
    apiClient.get<FeatureFlag[]>('/admin/feature-flags'),
  create: (data: { key: string; description?: string }) =>
    apiClient.post<FeatureFlag>('/admin/feature-flags', data),
  toggle: (id: string) =>
    apiClient.patch(`/admin/feature-flags/${id}/toggle`),
};

// ── Notifications ──
export const adminNotificationsApi = {
  getTemplates: () =>
    apiClient.get<NotificationTemplate[]>('/admin/notifications/templates'),
  send: (data: {
    targetUserId: string;
    channel: string;
    relatedAuditLogId?: string;
    messageTemplate: string;
    customMessage?: string;
  }) => apiClient.post('/admin/notifications/send', data),
};

// ── Break Glass ──
export const adminBreakGlassApi = {
  attempt: (code: string) =>
    apiClient.post('/admin/break-glass', { code }),
};
