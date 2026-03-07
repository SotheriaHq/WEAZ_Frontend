import { apiClient } from './httpClient';
import type {
  AdminUser,
  AdminReactivationRequest,
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
  FeaturedItem,
  FeaturedSlotsSummary,
  EligibleEntity,
} from '../types/admin';

type Paginated<T> = { items: T[]; nextCursor?: string };

// ── Dashboard ──
export const adminDashboardApi = {
  getStats: () =>
    apiClient.get<{
      totalUsers: number;
      activeUsers30d: number;
      totalBrands: number;
      pendingVerifications: number;
      pendingPayouts: number;
      openDisputes: number;
      recentLogs: { id: string; action: string; targetType: string; targetId: string; createdAt: string; actorUserId: string }[];
    }>('/admin/dashboard/stats'),
};

// ── Users ──
export const adminUsersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminUser>>('/admin/users', { params }),
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
  hardDeleteSeeded: (id: string) =>
    apiClient.delete(`/admin/users/${id}/hard-delete`),
  listReactivationRequests: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminReactivationRequest>>(
      '/admin/users/reactivation-requests',
      { params },
    ),
  reviewReactivationRequest: (
    requestId: string,
    data: { decision: 'APPROVE' | 'REJECT'; adminNote?: string },
  ) =>
    apiClient.patch(`/admin/users/reactivation-requests/${requestId}`, data),
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
  getVerificationQueue: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminBrand>>('/admin/brands/verification-queue', { params }),
  getVerificationDetails: (id: string) =>
    apiClient.get(`/admin/brands/${id}/verification`),
  reviewVerification: (id: string, data: { decision: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
    apiClient.patch(`/admin/brands/${id}/verification`, data),
};

// ── Products ──
export const adminProductsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminProduct>>('/admin/products', { params }),
  moderate: (id: string, data: { isActive?: boolean }) =>
    apiClient.patch(`/admin/products/${id}/moderate`, data),
};

// ── Featured ──
export const adminFeaturedApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<FeaturedItem>>('/admin/featured', { params }),
  listActive: () =>
    apiClient.get<FeaturedItem[]>('/admin/featured/active'),
  getSlots: () =>
    apiClient.get<FeaturedSlotsSummary>('/admin/featured/slots'),
  search: (params?: Record<string, string>) =>
    apiClient.get<EligibleEntity[]>('/admin/featured/search', { params }),
  history: (params?: Record<string, string>) =>
    apiClient.get<Paginated<FeaturedItem>>('/admin/featured/history', { params }),
  getPerformance: (id: string) =>
    apiClient.get('/admin/featured/' + id + '/performance'),
  create: (data: { entityType: string; entityId: string; startsAt?: string; displayImages?: string[]; useCoverOnly?: boolean }) =>
    apiClient.post<FeaturedItem>('/admin/featured', data),
  remove: (id: string) =>
    apiClient.delete('/admin/featured/' + id),
  toggleBlockProduct: (id: string) =>
    apiClient.patch('/admin/featured/block/product/' + id),
  toggleBlockCollection: (id: string) =>
    apiClient.patch('/admin/featured/block/collection/' + id),
  toggleBlockBrand: (id: string) =>
    apiClient.patch('/admin/featured/block/brand/' + id),
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
  listCategories: (includeInactive?: boolean) =>
    apiClient.get<AdminCategory[]>('/admin/categories', { params: includeInactive ? { includeInactive: 'true' } : undefined }),
  listSubCategories: (categoryId: string, includeInactive?: boolean) =>
    apiClient.get<Array<{ id: string; name: string; slug?: string; description?: string; order?: number }>>(
      `/admin/categories/${categoryId}/sub-categories`,
      { params: includeInactive ? { includeInactive: 'true' } : undefined },
    ),
  createCategory: (data: { name: string; slug?: string; description?: string; order?: number }) =>
    apiClient.post<AdminCategory>('/admin/categories', data),
  updateCategory: (id: string, data: { name?: string; slug?: string; description?: string; order?: number }) =>
    apiClient.patch<AdminCategory>(`/admin/categories/${id}`, data),
  activateCategory: (id: string) =>
    apiClient.patch(`/admin/categories/${id}/activate`),
  deactivateCategory: (id: string) =>
    apiClient.patch(`/admin/categories/${id}/deactivate`),
  deleteCategory: (id: string) =>
    apiClient.delete(`/admin/categories/${id}`),
};

// ── Tags ──
export const adminTagsApi = {
  list: (params?: Record<string, string | number>) => apiClient.get<AdminTagItem[] | Paginated<AdminTagItem>>('/tags', { params: { limit: 100, ...params } }),
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
  getQueue: (params?: Record<string, string>) =>
    apiClient.get('/admin/moderation/queue', { params }),
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
  recoverSuperAdmin: (data: {
    recoveryToken: string;
    email: string;
    firstName: string;
    lastName: string;
  }) => apiClient.post('/admin/break-glass/recover-superadmin', data),
};
