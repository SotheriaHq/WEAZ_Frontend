import { apiClient } from './httpClient';
import type {
  AdminUser,
  AdminReactivationRequest,
  AdminBrand,
  AdminProduct,
  AdminCollection,
  AdminDesign,
  AdminPayout,
  AdminPayoutDetail,
  AdminStandardOrderListResponse,
  AdminStandardOrderDetail,
  AdminDispute,
  AdminAuditLog,
  AdminSlaConfig,
  FeatureFlag,
  NotificationTemplate,
  AdminCategory,
  AdminTagItem,
  AdminTagLifecycleDetails,
  AdminMeasurementPointRow,
  AdminMeasurementPointLifecycleDetails,
  FeaturedItem,
  FeaturedSlotsSummary,
  EligibleEntity,
  AdminCommissionRule,
  AdminReconciliationRun,
  AdminReconciliationItem,
  AdminFinancialDocument,
  AdminFinanceOverview,
  AdminLedgerTransaction,
  AdminFinancePaymentAttempt,
  AdminFinancePaymentDetail,
  AdminFinanceTransaction,
  AdminStalePaymentReconcileResult,
  AdminEscrowHold,
} from '../types/admin';
import type {
  AdminVerificationDetails,
  VerificationNote,
  VerificationQueueResponse,
  VerificationReason,
} from '../types/verification';

type Paginated<T> = { items: T[]; nextCursor?: string };

// ── Dashboard ──
export const adminDashboardApi = {
  getStats: () =>
    apiClient.get<{
      totalUsers: number;
      activeUsers30d: number;
      dailySignupCount: number;
      showDailySignupCount: boolean;
      totalBrands: number;
      pendingVerifications: number;
      pendingPayouts: number;
      openDisputes: number;
      recentLogs: {
        id: string;
        action: string;
        targetType: string;
        targetId: string;
        createdAt: string;
        actorUserId: string;
        actorName?: string | null;
        actorImage?: string | null;
        targetName?: string | null;
        targetImage?: string | null;
        targetStatus?: string | null;
        targetRoute?: string | null;
      }[];
    }>('/admin/dashboard/stats'),
};

// ── Users ──
export const adminUsersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminUser>>('/admin/users', { params }),
  getById: (id: string) =>
    apiClient.get<AdminUser>(`/admin/users/${id}`),
  create: (data: { email: string; firstName: string; lastName: string }) =>
    apiClient.post<AdminUser>('/admin/users', data),
  updateRole: (id: string, role: string) =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),
  updatePermissions: (id: string, permissions: string[]) =>
    apiClient.patch(`/admin/users/${id}/permissions`, { permissions }),
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/admin/users/${id}/status`, { status, reason }),
  forcePasswordReset: (id: string) =>
    apiClient.post(`/admin/users/${id}/force-password-reset`),
  reissueTempPassword: (
    id: string,
    data: { actorEmail: string; actorUserIdConfirm: string; targetUserIdConfirm: string },
  ) => apiClient.post(`/admin/users/${id}/reissue-temp-password`, data),
  deleteAdminUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}/data-wipe`, {
      headers: { 'x-confirm-wipe': 'true' },
    }),
  permanentlyDeleteAdminUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}/permanent-delete`),
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
    apiClient.get<VerificationQueueResponse>('/admin/brands/verification-queue', { params }),
  getVerificationRejectionReasons: () =>
    apiClient.get<{ reasons: VerificationReason[] }>('/admin/brands/verification-rejection-reasons'),
  getVerificationDetails: (id: string) =>
    apiClient.get<AdminVerificationDetails>(`/admin/brands/${id}/verification`),
  claimVerification: (id: string, expectedUpdatedAt?: string) =>
    apiClient.patch(`/admin/brands/${id}/verification/claim`, { expectedUpdatedAt }),
  releaseVerification: (id: string, expectedUpdatedAt?: string) =>
    apiClient.patch(`/admin/brands/${id}/verification/release`, { expectedUpdatedAt }),
  reassignVerificationToSelf: (id: string, expectedUpdatedAt?: string) =>
    apiClient.patch(`/admin/brands/${id}/verification/reassign-to-self`, { expectedUpdatedAt }),
  requestVerificationInfo: (
    id: string,
    data: { items: Array<{ field: string; label: string; message?: string }>; generalMessage?: string; expectedUpdatedAt?: string },
  ) => apiClient.patch(`/admin/brands/${id}/verification/request-info`, data),
  reviewVerification: (
    id: string,
    data: { decision: 'APPROVED' | 'REJECTED'; rejectionReasons?: Array<{ code: string; label: string; customReason?: string }>; expectedUpdatedAt?: string },
  ) =>
    apiClient.patch(`/admin/brands/${id}/verification`, data),
  getVerificationNotes: (id: string) =>
    apiClient.get<{ notes: VerificationNote[] }>(`/admin/brands/${id}/verification/notes`),
  addVerificationNote: (id: string, text: string) =>
    apiClient.post<VerificationNote>(`/admin/brands/${id}/verification/notes`, { text }),
};

// ── Products ──
export const adminProductsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminProduct>>('/admin/products', { params }),
  moderate: (id: string, data: { isActive?: boolean; action?: 'UNPUBLISH' | 'REPUBLISH' | 'HARD_DELETE'; reason?: string }) =>
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
  moderate: (id: string, data: { status?: string; action?: 'UNPUBLISH' | 'REPUBLISH' | 'HARD_DELETE'; reason?: string }) =>
    apiClient.patch(`/admin/collections/${id}/moderate`, data),
};

export const adminDesignsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminDesign>>('/admin/designs', { params }),
  moderate: (id: string, data: { status?: string; action?: 'UNPUBLISH' | 'REPUBLISH' | 'HARD_DELETE'; reason?: string }) =>
    apiClient.patch(`/admin/designs/${id}/moderate`, data),
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
  createSubCategory: (
    categoryId: string,
    data: { name: string; description?: string; order?: number },
  ) => apiClient.post(`/admin/categories/${categoryId}/sub-categories`, data),
  updateSubCategory: (
    subCategoryId: string,
    data: { name?: string; description?: string; order?: number },
  ) => apiClient.patch(`/admin/categories/sub-categories/${subCategoryId}`, data),
  activateSubCategory: (subCategoryId: string) =>
    apiClient.patch(`/admin/categories/sub-categories/${subCategoryId}/activate`),
  deactivateSubCategory: (subCategoryId: string) =>
    apiClient.patch(`/admin/categories/sub-categories/${subCategoryId}/deactivate`),
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
  list: (params?: Record<string, string | number>) =>
    apiClient.get<AdminTagItem[] | Paginated<AdminTagItem>>('/tags/admin', {
      params: { limit: 100, ...params },
    }),
  search: (q: string, limit = 20, params?: Record<string, string | number>) =>
    apiClient.get<{ items: AdminTagItem[] }>('/tags/admin/search', {
      params: { q, limit, ...params },
    }),
  getLifecycle: (normalizedName: string) =>
    apiClient.get<AdminTagLifecycleDetails>(`/tags/${encodeURIComponent(normalizedName)}/lifecycle`),
  updateMetadata: (normalizedName: string, data: { displayName?: string }) =>
    apiClient.patch<AdminTagItem>(`/tags/admin/meta/${encodeURIComponent(normalizedName)}`, data),
  updateStatus: (
    normalizedName: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) =>
    apiClient.patch<AdminTagItem>(
      `/tags/admin/status/${encodeURIComponent(normalizedName)}`,
      { status },
    ),
  ban: (normalizedName: string, banned = true) =>
    apiClient.post(`/tags/admin/ban/${encodeURIComponent(normalizedName)}`, null, {
      params: { banned: banned ? 'true' : 'false' },
    }),
  merge: (sourceTag: string, targetTag: string) =>
    apiClient.post('/tags/admin/merge', { sourceTag, targetTag }),
  reindex: () => apiClient.post('/tags/admin/reindex'),
};

// ── Payouts ──
export const adminPayoutsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AdminPayout[] | Paginated<AdminPayout>>('/admin/payouts', { params }),
  getById: (id: string) =>
    apiClient.get<AdminPayoutDetail>(`/admin/payouts/${id}`),
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/admin/payouts/${id}/status`, { status, reason }),
  claim: (id: string) => apiClient.post<AdminPayout>(`/admin/payouts/${id}/claim`),
  release: (id: string, reason?: string) =>
    apiClient.post<AdminPayout>(`/admin/payouts/${id}/release`, { reason }),
  initiateTransfer: (id: string) =>
    apiClient.post<AdminPayout>(`/admin/payouts/${id}/initiate-transfer`),
  finalizeTransferOtp: (id: string, otp: string) =>
    apiClient.post<AdminPayout>(`/admin/payouts/${id}/finalize-transfer-otp`, { otp }),
  getProviderStatus: (id: string) =>
    apiClient.get<AdminPayout>(`/admin/payouts/${id}/provider-status`),
};

export const adminOrdersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AdminStandardOrderListResponse>('/admin/orders', { params }),
  getById: (id: string) =>
    apiClient.get<AdminStandardOrderDetail>(`/admin/orders/${id}`),
};

// ── Disputes ──
export const adminDisputesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Paginated<AdminDispute>>('/admin/disputes', { params }),
  create: (data: { type: string; reporterId: string; targetType: string; targetId: string; description: string }) =>
    apiClient.post<AdminDispute>('/admin/disputes', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/disputes/${id}`, data),
  claim: (id: string) => apiClient.post<AdminDispute>(`/admin/disputes/${id}/claim`),
  release: (id: string, reason?: string) =>
    apiClient.post<AdminDispute>(`/admin/disputes/${id}/release`, { reason }),
  reopen: (id: string, reason: string) =>
    apiClient.post(`/admin/disputes/${id}/reopen`, { reason }),
};

// ── Moderation ──
export const adminModerationApi = {
  getQueue: (params?: Record<string, string>) =>
    apiClient.get('/admin/moderation/queue', { params }),
  reviewItem: (id: string, data: { action: string; reason?: string }) =>
    apiClient.patch(`/admin/moderation/items/${id}`, data),
  listMeasurementPoints: (params?: Record<string, string | number>) =>
    apiClient.get<{ items: AdminMeasurementPointRow[]; nextCursor?: string | null }>(
      '/admin/moderation/measurement-points',
      { params },
    ),
  getMeasurementPointLifecycle: (id: string) =>
    apiClient.get<AdminMeasurementPointLifecycleDetails>(
      `/admin/moderation/measurement-points/${encodeURIComponent(id)}/lifecycle`,
    ),
  updateMeasurementPointLifecycle: (
    id: string,
    data: { action: 'approve' | 'reject' | 'activate' | 'deactivate'; reason?: string },
  ) =>
    apiClient.patch(
      `/admin/moderation/measurement-points/${encodeURIComponent(id)}/lifecycle`,
      data,
    ),
};

export const adminReviewsApi = {
  getReviews: (params?: Record<string, string>) =>
    apiClient.get('/admin/reviews', { params }),
  getReports: (params?: Record<string, string>) =>
    apiClient.get('/admin/reviews/reports', { params }),
  moderateReview: (
    reviewId: string,
    data: { action: 'KEEP' | 'HIDE' | 'RESTORE' | 'DELETE'; reason?: string; moderatorNote?: string },
  ) => apiClient.patch(`/admin/reviews/${reviewId}/moderation`, data),
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

// —— Finance ——
export const adminFinanceApi = {
  getOverview: () =>
    apiClient.get<AdminFinanceOverview>('/admin/finance/overview'),
  listCommissionRules: () =>
    apiClient.get<AdminCommissionRule[]>('/admin/finance/commission-rules'),
  createCommissionRule: (data: {
    name: string;
    scope?: 'PLATFORM' | 'BRAND';
    brandId?: string | null;
    currency?: string | null;
    ratePercent: number;
    minFeeAmount?: number | null;
    maxFeeAmount?: number | null;
    isDefault?: boolean;
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  }) => apiClient.post<AdminCommissionRule>('/admin/finance/commission-rules', data),
  updateCommissionRule: (
    id: string,
    data: {
      name?: string;
      currency?: string | null;
      ratePercent?: number;
      minFeeAmount?: number | null;
      maxFeeAmount?: number | null;
      isDefault?: boolean;
      isActive?: boolean;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    },
  ) => apiClient.patch<AdminCommissionRule>(`/admin/finance/commission-rules/${id}`, data),
  createReconciliationRun: (data: { scope: 'PAYMENTS' | 'PAYOUTS' | 'LEDGER_INTEGRITY' }) =>
    apiClient.post<AdminReconciliationRun>('/admin/finance/reconciliation-runs', data),
  listReconciliationRuns: (params?: Record<string, string>) =>
    apiClient.get<AdminReconciliationRun[]>('/admin/finance/reconciliation-runs', { params }),
  listReconciliationItems: (params?: Record<string, string>) =>
    apiClient.get<AdminReconciliationItem[]>('/admin/finance/reconciliation-items', { params }),
  claimReconciliationItem: (id: string) =>
    apiClient.post<AdminReconciliationItem>(`/admin/finance/reconciliation-items/${id}/claim`),
  releaseReconciliationItem: (id: string, reason?: string) =>
    apiClient.post<AdminReconciliationItem>(`/admin/finance/reconciliation-items/${id}/release`, { reason }),
  resolveReconciliationItem: (id: string, note: string) =>
    apiClient.post<AdminReconciliationItem>(`/admin/finance/reconciliation-items/${id}/resolve`, { note }),
  listDocuments: (params?: Record<string, string>) =>
    apiClient.get<AdminFinancialDocument[]>('/admin/finance/documents', { params }),
  getDocument: (id: string) =>
    apiClient.get<AdminFinancialDocument>(`/admin/finance/documents/${id}`),
  listPayments: (params?: Record<string, string>) =>
    apiClient.get<{ items: AdminFinancePaymentAttempt[]; total: number }>('/admin/finance/payments', { params }),
  reconcileStalePayments: (data?: { olderThanMinutes?: number; limit?: number }) =>
    apiClient.post<AdminStalePaymentReconcileResult>('/payment/reconcile/stale', data ?? {}),
  getPayment: (reference: string) =>
    apiClient.get<AdminFinancePaymentDetail>(`/admin/finance/payments/${reference}`),
  listTransactions: (params?: Record<string, string>) =>
    apiClient.get<{ items: AdminFinanceTransaction[]; total: number }>('/admin/finance/transactions', { params }),
  listEscrowHolds: (params?: Record<string, string>) =>
    apiClient.get<{ items: AdminEscrowHold[]; total: number }>('/admin/finance/escrow-holds', { params }),
  releaseEscrowHold: (
    id: string,
    data: { holdType: 'STANDARD_ORDER' | 'CUSTOM_ORDER'; note?: string },
  ) => apiClient.post(`/admin/finance/escrow-holds/${id}/release`, data),
  freezeEscrowHold: (id: string, reason: string) =>
    apiClient.post(`/admin/finance/escrow-holds/${id}/freeze`, { reason }),
  unfreezeEscrowHold: (id: string) =>
    apiClient.post(`/admin/finance/escrow-holds/${id}/unfreeze`),
  listBooks: (params?: Record<string, string>) =>
    apiClient.get<AdminLedgerTransaction[]>('/admin/ledger', { params }),
};
