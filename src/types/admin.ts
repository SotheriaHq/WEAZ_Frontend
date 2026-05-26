import type { PayoutSourceBreakdown } from './payouts';

export type AdminPermissionCode =
  | 'USERS_READ' | 'USERS_WRITE' | 'USERS_SUSPEND' | 'USERS_DEACTIVATE' | 'USERS_NOTIFY'
  | 'BRANDS_READ' | 'BRANDS_WRITE' | 'BRANDS_SUSPEND' | 'BRANDS_VERIFY' | 'BRANDS_STORE_OVERRIDE'
  | 'PRODUCTS_READ' | 'PRODUCTS_WRITE' | 'PRODUCTS_DELETE'
  | 'COLLECTIONS_READ' | 'COLLECTIONS_WRITE' | 'COLLECTIONS_DELETE'
  | 'TAXONOMY_READ' | 'TAXONOMY_WRITE'
  | 'TAGS_READ' | 'TAGS_WRITE'
  | 'MODERATION_READ' | 'MODERATION_REVIEW' | 'MODERATION_QUARANTINE'
  | 'MEASUREMENTS_READ' | 'MEASUREMENTS_REVIEW'
  | 'PAYOUTS_READ' | 'PAYOUTS_PROCESS'
  | 'DISPUTES_READ' | 'DISPUTES_RESOLVE'
  | 'FEATURED_MANAGE'
  | 'AUDIT_READ'
  | 'MARKET_GOVERNANCE_READ' | 'MARKET_GOVERNANCE_WRITE' | 'MARKET_GOVERNANCE_RELEASE'
  | 'MARKET_RANKING_FORMULA_WRITE' | 'MARKET_RANKING_ROLLBACK' | 'MARKET_SUGGESTIONS_WRITE'
  | 'SYSTEM_FEATURE_FLAGS' | 'SYSTEM_BREAK_GLASS' | 'SYSTEM_ROLE_ASSIGN'
  | 'SYSTEM_PERMISSION_ASSIGN' | 'SYSTEM_SLA_READ' | 'SYSTEM_SLA_WRITE'
  | 'SYSTEM_DATA_EXPORT' | 'SYSTEM_DATA_DELETE';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: 'SuperAdmin' | 'Admin' | 'User';
  type?: 'BRAND' | 'REGULAR';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  profileImage?: string | null;
  profileImageId?: string | null;
  profileImageFile?: { id: string; s3Url: string } | null;
  createdAt: string;
  updatedAt: string;
  permissions?: { permissionCode: string }[];
}

export interface AdminReactivationRequest {
  id: string;
  userId: string;
  emailSnapshot: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'SuperAdmin' | 'Admin' | 'User';
    status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  };
  reviewedBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AdminBrand {
  id: string;
  name: string | null;
  ownerId?: string;
  isStoreOpen?: boolean;
  description?: string | null;
  logo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  owner?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status?: string;
    profileImage?: string | null;
  };
}

export interface AdminPayout {
  id: string;
  brandId: string;
  amount: string;
  currency: string;
  provider?: string | null;
  providerRecipientCode?: string | null;
  providerRecipientId?: string | null;
  providerTransferCode?: string | null;
  providerTransferId?: string | null;
  providerTransferReference?: string | null;
  providerTransferStatus?: string | null;
  providerTransferFailureCode?: string | null;
  providerTransferFailureMessage?: string | null;
  providerTransferInitiatedAt?: string | null;
  providerTransferFinalizedAt?: string | null;
  providerTransferReversedAt?: string | null;
  status:
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'REJECTED'
    | 'ON_HOLD'
    | 'RECONCILIATION_REVIEW';
  reference: string | null;
  gatewayReference?: string | null;
  statusReason?: string | null;
  failureReason?: string | null;
  approvedAt?: string | null;
  claimedAt?: string | null;
  processedAt?: string | null;
  paidAt?: string | null;
  assignedAdminId?: string | null;
  assignedAt?: string | null;
  createdAt: string;
  brand?: { id: string; name: string };
  assignedAdmin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface AdminPayoutEvent {
  id: string;
  type: string;
  source: string;
  providerEventType?: string | null;
  providerEventReceivedAt?: string | null;
  processedAt?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminPayoutAccountSummary {
  id: string | null;
  status: string;
  provider: string;
  bankName: string | null;
  accountName: string | null;
  maskedAccountNumber: string | null;
  subaccountCode: string | null;
  transferRecipientCode: string | null;
  transferRecipientActive: boolean;
  lastSyncError: string | null;
  subaccountLastSyncAt: string | null;
  transferRecipientLastSyncAt: string | null;
  updatedAt: string | null;
}

export interface AdminPayoutDetail extends AdminPayout {
  events: AdminPayoutEvent[];
  payoutAccount: AdminPayoutAccountSummary | null;
  sourceBreakdown: PayoutSourceBreakdown;
}

export interface AdminStandardOrderLineItem {
  id: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  sizingMode?: string | null;
  requiredMeasurementKeys?: string[] | null;
  sizeFitSnapshot?: Record<string, unknown> | null;
  thumbnailAtPurchase?: string | null;
  nameAtPurchase?: string | null;
}

export interface AdminStandardOrderFinanceBreakdown {
  currency: string;
  itemSubtotal: number;
  shippingAmount: number;
  discountAmount: number;
  grossAmount: number;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  paidAt?: string | null;
  escrowStatus?: string | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  netBrandAmount?: number | null;
  releaseSchedule?: Array<{
    stage: 'SHIPPED_RELEASE' | 'DELIVERED_RELEASE' | string;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    releasedAt?: string | null;
    eligibleAt?: string | null;
    condition?: string | null;
  }>;
  ledgerTransactions?: Array<{
    id: string;
    type: string;
    description: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
    entries: Array<{
      id: string;
      direction: 'DEBIT' | 'CREDIT';
      amount: number;
      accountCode?: string | null;
      accountName?: string | null;
      accountType?: string | null;
      accountSubType?: string | null;
    }>;
  }>;
}

export interface AdminStandardOrderBuyerReceipt {
  id: string;
  documentNumber: string;
  type: string;
  issuedAt: string;
  currency: string;
  grossAmount: number;
  commissionAmount?: number | null;
  netAmount?: number | null;
  paymentAttemptId?: string | null;
  paymentReference?: string | null;
  settlementCurrency?: string | null;
  settlementAmount?: number | null;
  issuedToName?: string | null;
  lineItems?: Array<{
    label: string;
    amount: number;
  }>;
}

export interface AdminStandardOrderDetail {
  id: string;
  brandId: string;
  buyerId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  formattedShippingAddress?: string | null;
  contactInfo?: Record<string, unknown> | null;
  totalAmount: string | number;
  shippingCost?: string | number | null;
  discountAmount?: string | number | null;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  orderItems: AdminStandardOrderLineItem[];
  financeBreakdown?: AdminStandardOrderFinanceBreakdown | null;
  buyerReceipt?: AdminStandardOrderBuyerReceipt | null;
  brand?: {
    id: string;
    name?: string | null;
    logo?: string | null;
    currency?: string | null;
    contactEmail?: string | null;
    owner?: {
      id?: string;
      phoneNumber?: string | null;
      address?: string | null;
    } | null;
  } | null;
}

export interface AdminStandardOrderListItem {
  id: string;
  brandId: string;
  buyerId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  totalAmount: string | number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentReference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  itemCount: number;
  primaryItemName?: string | null;
  primaryItemImage?: string | null;
  brand?: {
    id: string;
    ownerId: string;
    name?: string | null;
  } | null;
}

export interface AdminStandardOrderListResponse {
  items: AdminStandardOrderListItem[];
  total: number;
  page: number;
  totalPages: number;
  summary?: {
    totalOrders: number;
    totalRevenue: string | number;
    pendingCount: number;
    processingCount: number;
    shippedCount: number;
    deliveredCount: number;
    cancelledCount: number;
    returnedCount: number;
  };
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  brandId: string;
  isActive: boolean;
  price: string;
  salePrice: string | null;
  currency: string;
  thumbnail?: string | null;
  images?: string[];
  primaryMediaUrl?: string | null;
  orderCount?: number;
  createdAt: string;
  updatedAt: string;
  brand?: { id: string; name: string | null };
}

export interface FeaturedItem {
  id: string;
  entityType: 'PRODUCT' | 'DESIGN';
  entityId: string;
  brandId: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  removedAt: string | null;
  removeReason: string | null;
  displayImages: string[] | null;
  useCoverOnly: boolean;
  viewsDelta: number;
  threadsDelta: number;
  clicksDelta: number;
  createdAt: string;
  entityName?: string;
  entityThumbnail?: string | null;
  brandName?: string;
  featuredBy?: { id: string; email: string };
  removedBy?: { id: string; email: string } | null;
  status?: 'active' | 'scheduled' | 'expired' | 'removed';
}

export interface FeaturedSlotsSummary {
  active: number;
  scheduled: number;
  total: number;
  remaining: number;
}

export interface EligibleEntity {
  entityType: 'PRODUCT' | 'DESIGN';
  entityId: string;
  name: string;
  brandId: string;
  brandName: string;
  thumbnail: string | null;
  eligible: boolean;
  reason: string | null;
}

export interface AdminCollection {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  visibility: string;
  ownerId: string;
  coverImage?: string | null;
  orderCount?: number;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; email: string; firstName: string; lastName: string };
}

export interface AdminDesign {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  visibility: string;
  ownerId: string;
  coverImage?: string | null;
  coverImageFileId?: string | null;
  orderCount?: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; email: string; firstName: string; lastName: string };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AdminTagStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminTagItem {
  name: string;
  usageCount: number;
  displayName?: string;
  status?: AdminTagStatus;
  isBanned?: boolean;
  aliasOfTagName?: string | null;
  lifecycleStage?: 'LIVE' | 'REJECTED' | 'ALIAS' | 'DORMANT';
  createdById?: string | null;
  createdBy?: AdminIdentitySnapshot | null;
  createdAt?: string;
  lastUsedAt?: string | null;
  updatedAt?: string;
}

export interface AdminIdentitySnapshot {
  id: string;
  username: string | null;
  brandFullName: string | null;
  profileImage: string | null;
}

export interface AdminTagLifecycleEvent {
  id: string;
  type: string;
  at: string;
  summary: string;
}

export interface AdminTagLifecycleActor {
  userId: string;
  username: string | null;
  brandFullName: string | null;
  profileImage: string | null;
  usageCount: number;
  latestTaggedAt: string | null;
}

export interface AdminTagLifecycleEntityUsage {
  entityType: string;
  entityId: string;
  usageCount: number;
  latestTaggedAt: string | null;
  label: string;
}

export interface AdminTagLifecycleDetails {
  name: string;
  displayName: string | null;
  usageCount: number;
  status?: AdminTagStatus;
  isBanned: boolean;
  lifecycleStage: 'LIVE' | 'REJECTED' | 'ALIAS' | 'DORMANT';
  createdById?: string | null;
  createdBy?: AdminIdentitySnapshot | null;
  lastUsedAt: string | null;
  aliasOf: {
    name: string;
    displayName: string | null;
  } | null;
  aliases: Array<{
    name: string;
    displayName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  resolvedTag: {
    id: string;
    name: string;
    displayName: string | null;
  };
  entityCounts: Record<string, number>;
  usage: {
    distinctUsersCount: number;
    users: AdminTagLifecycleActor[];
    entities: AdminTagLifecycleEntityUsage[];
  };
  timeline: AdminTagLifecycleEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminMeasurementPointRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  gender: string | null;
  source: string;
  status: string;
  brandId: string | null;
  brand: {
    id: string;
    name: string;
    ownerId: string;
    owner: AdminIdentitySnapshot;
  } | null;
  minValueCm: number | null;
  maxValueCm: number | null;
  minValueChildCm?: number | null;
  maxValueChildCm?: number | null;
  sortOrder: number;
  isActive: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: AdminIdentitySnapshot | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMeasurementLifecycleEvent {
  id: string;
  type: string;
  at: string;
  summary: string;
}

export interface AdminMeasurementLifecycleUserUsage {
  userId: string;
  username: string | null;
  brandFullName: string | null;
  profileImage: string | null;
  usageCount: number;
  latestUsedAt: string | null;
}

export interface AdminMeasurementPointLifecycleDetails {
  point: AdminMeasurementPointRow;
  usage: {
    collectionUsageCountById: number;
    collectionUsageCountByKey: number;
    productUsageCountById: number;
    productUsageCountByKey: number;
    distinctUsersCount: number;
    users: AdminMeasurementLifecycleUserUsage[];
  };
  references: {
    collections: Array<{
      id: string;
      title: string | null;
      ownerId: string;
      status: string;
      visibility: string;
      createdAt: string;
      updatedAt: string;
    }>;
    products: Array<{
      id: string;
      name: string;
      isActive: boolean;
      brandId: string;
      brandName: string;
      ownerId: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  timeline: AdminMeasurementLifecycleEvent[];
}

export interface AdminDispute {
  id: string;
  type: 'ORDER' | 'PRODUCT' | 'SIZING' | 'GENERAL';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  description: string;
  reporterId: string;
  assignedToId: string | null;
  assignedAt?: string | null;
  resolvedById: string | null;
  resolution: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  assignedTo?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: { email: string; firstName: string; lastName: string };
}

export type AdminMarketSectionKey =
  | 'fresh-drops'
  | 'hot-right-now'
  | 'latest-collections'
  | 'shop-by-style'
  | 'custom-ready'
  | 'new-designers-to-watch';

export type AdminMarketSuggestionContext =
  | 'PRODUCT_DETAIL'
  | 'COLLECTION_DETAIL'
  | 'BRAND_DETAIL'
  | 'SEARCH_EMPTY'
  | 'MARKET_SECTION_DETAIL';

export type AdminMarketSuggestionTargetType =
  | 'PRODUCT'
  | 'COLLECTION'
  | 'BRAND'
  | 'CATEGORY'
  | 'SECTION'
  | 'QUERY';

export type AdminMarketSuggestionSourceType =
  | 'PRODUCT'
  | 'COLLECTION'
  | 'BRAND'
  | 'CATEGORY'
  | 'MIXED';

export type AdminMarketRankingFormulaStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'ROLLED_BACK';

export type AdminMarketConfigSource = 'code-default' | 'db' | string;

export interface AdminMarketGovernanceListResponse<T> {
  items: T[];
  nextCursor?: string | null;
  configReadStatus?: string | null;
}

export type AdminMarketGovernanceAuditLogListResponse =
  AdminMarketGovernanceListResponse<AdminAuditLog>;

export interface AdminMarketSectionConfig {
  id?: string;
  sectionKey: AdminMarketSectionKey;
  title: string;
  subtitle: string | null;
  enabled: boolean;
  displayOrder: number;
  previewItemLimit: number;
  detailPageLimit: number;
  minimumItems: number;
  viewAllEnabled: boolean;
  fallbackMode: string;
  metadata: Record<string, unknown> | null;
  source?: AdminMarketConfigSource;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminMarketRankingFormulaVersion {
  id: string;
  versionKey: string;
  name: string;
  status: AdminMarketRankingFormulaStatus;
  weights: Record<string, number>;
  bounds: Record<string, unknown> | null;
  notes: string | null;
  createdById?: string | null;
  createdAt: string;
  activatedAt: string | null;
  deprecatedAt: string | null;
}

export interface AdminMarketRankingProfile {
  id: string;
  profileKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
  shadowMode: boolean;
  sectionKeys: AdminMarketSectionKey[] | string[];
  formulaVersionId: string | null;
  formulaVersion?: AdminMarketRankingFormulaVersion | null;
  explorationPercent: number;
  brandMaxShare: number;
  aggregateTimeoutMs: number;
  rolloutPercent: number;
  fallbackDeterministic: boolean;
  metadata: Record<string, unknown> | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMarketSuggestionBlockConfig {
  id?: string;
  blockKey: string;
  context: AdminMarketSuggestionContext;
  targetType: AdminMarketSuggestionTargetType;
  title: string;
  subtitle: string | null;
  enabled: boolean;
  displayOrder: number;
  sourceType: AdminMarketSuggestionSourceType | string;
  fallbackSourceType: AdminMarketSuggestionSourceType | string | null;
  itemLimit: number;
  metadata: Record<string, unknown> | null;
  source?: AdminMarketConfigSource;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminMarketGovernanceReleaseStatus {
  rankingEnabled: boolean;
  rankingDefaultDisabled: boolean;
  deterministicFallbackEnabled: boolean;
  shadowMode: boolean;
  activeRankingProfile: AdminMarketRankingProfile | null;
  activeFormulaVersion: AdminMarketRankingFormulaVersion | null;
  configReadStatus: string;
  lastRollback: AdminAuditLog | null;
  productionReady: boolean;
  phase14Required: boolean;
}

export interface AdminMarketGovernanceRollbackResult {
  rolledBack: boolean;
  restoredFormulaVersion: AdminMarketRankingFormulaVersion;
  rolledBackFormulaVersion: AdminMarketRankingFormulaVersion;
  rankingProfileRollback: string;
  historyPreserved: boolean;
}

export interface AdminMarketGovernanceRollbackRehearsal {
  rehearsalOnly: boolean;
  mutatesConfig: boolean;
  deterministicFallbackAvailable: boolean;
  canRollbackFormula: boolean;
  activeFormulaVersion: AdminMarketRankingFormulaVersion | null;
  candidatePriorFormulaVersion: AdminMarketRankingFormulaVersion | null;
  rankingProfileRollback: string;
  wouldMutate: string[];
}

export type AdminMarketSectionConfigUpdate = Partial<
  Pick<
    AdminMarketSectionConfig,
    | 'title'
    | 'subtitle'
    | 'enabled'
    | 'displayOrder'
    | 'previewItemLimit'
    | 'detailPageLimit'
    | 'minimumItems'
    | 'viewAllEnabled'
    | 'fallbackMode'
    | 'metadata'
  >
> & { reason?: string };

export type AdminMarketRankingProfileUpsert = Partial<
  Pick<
    AdminMarketRankingProfile,
    | 'name'
    | 'description'
    | 'enabled'
    | 'shadowMode'
    | 'sectionKeys'
    | 'formulaVersionId'
    | 'explorationPercent'
    | 'brandMaxShare'
    | 'aggregateTimeoutMs'
    | 'rolloutPercent'
    | 'fallbackDeterministic'
    | 'metadata'
  >
> & {
  profileKey?: string;
  reason?: string;
};

export interface AdminMarketRankingFormulaCreate {
  versionKey: string;
  name: string;
  status?: AdminMarketRankingFormulaStatus;
  weights: Record<string, number>;
  bounds?: Record<string, unknown>;
  notes?: string;
  reason?: string;
}

export type AdminMarketSuggestionBlockUpsert = Partial<
  Pick<
    AdminMarketSuggestionBlockConfig,
    | 'context'
    | 'targetType'
    | 'title'
    | 'subtitle'
    | 'enabled'
    | 'displayOrder'
    | 'sourceType'
    | 'fallbackSourceType'
    | 'itemLimit'
    | 'metadata'
  >
> & {
  blockKey?: string;
  reason?: string;
};

export interface AdminSlaConfig {
  id: string;
  area: string;
  targetHours: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  createdBy?: { email: string; firstName: string; lastName: string };
}

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  subject: string;
  body: string;
}

export interface AdminCommissionRule {
  id: string;
  name: string;
  scope: 'PLATFORM' | 'BRAND';
  brandId?: string | null;
  currency?: string | null;
  ratePercent: string;
  minFeeAmount?: string | null;
  maxFeeAmount?: string | null;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSettlementPolicy {
  id: string;
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  scope: 'PLATFORM' | 'BRAND';
  brandId?: string | null;
  currency?: string | null;
  releaseMode: 'HOLD_UNTIL_DELIVERY' | 'SPLIT_RELEASE';
  upfrontReleaseEnabled: boolean;
  upfrontReleasePercent: string | number;
  settlementDelayHours: number;
  autoReleaseDays: number;
  finalReleaseTrigger: string;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSettlementResolvedPolicy {
  id: string | null;
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  scope: 'PLATFORM' | 'BRAND';
  brandId?: string | null;
  currency?: string | null;
  releaseMode: 'HOLD_UNTIL_DELIVERY' | 'SPLIT_RELEASE';
  upfrontReleaseEnabled: boolean;
  upfrontReleasePercent: number;
  settlementDelayHours: number;
  autoReleaseDays: number;
  finalReleaseTrigger: string;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface AdminSettlementBreakdown {
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  brandId: string;
  orderId?: string | null;
  customOrderId?: string | null;
  grossAmount: number;
  currency: string;
  commissionRuleId: string | null;
  commissionScope: string | null;
  commissionSource: string | null;
  commissionRate: number;
  commissionAmount: number;
  brandNetAmount: number;
  settlementPolicyId: string | null;
  releaseMode: 'HOLD_UNTIL_DELIVERY' | 'SPLIT_RELEASE';
  upfrontReleaseEnabled: boolean;
  upfrontReleasePercent: number;
  upfrontReleaseGrossAmount: number;
  upfrontReleaseCommissionAmount: number;
  upfrontReleaseNetBrandAmount: number;
  finalReleaseGrossAmount: number;
  finalReleaseCommissionAmount: number;
  finalReleaseNetBrandAmount: number;
  settlementDelayHours: number;
  autoReleaseDays: number;
  finalReleaseTrigger: string;
  calculatedAt: string;
}

export interface AdminSettlementPolicyPreview {
  writesSnapshot: boolean;
  writesLedger: boolean;
  resolvedSettlementPolicy: AdminSettlementResolvedPolicy;
  settlementBreakdown: AdminSettlementBreakdown;
  commissionBreakdown: {
    commissionRuleId: string | null;
    commissionSource: string | null;
    commissionScope: string | null;
    commissionRate: number;
    commissionAmount: number;
  };
}

export interface AdminFinanceSettlementState {
  currency: string;
  totalHeldFunds: number;
  upfrontReleasedFunds: number;
  finalReleasePendingFunds: number;
  finalReleaseEligibleFunds: number;
  frozenFunds: number;
  refundedFunds: number;
  availableBrandWalletFunds: number;
  payoutPendingFunds: number;
  paidOutFunds: number;
}

export interface AdminReconciliationRun {
  id: string;
  scope: 'PAYMENTS' | 'PAYOUTS' | 'LEDGER_INTEGRITY';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedById?: string | null;
  filtersJson?: Record<string, unknown> | null;
  summaryJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

export interface AdminReconciliationItem {
  id: string;
  runId: string;
  status: 'MATCHED' | 'UNMATCHED_INTERNAL' | 'DISCREPANCY' | 'RESOLVED';
  referenceType: string;
  referenceId?: string | null;
  expectedAmount?: string | null;
  actualAmount?: string | null;
  currency?: string | null;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
  assignedAdminId?: string | null;
  assignedAt?: string | null;
  releasedAt?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFinancialDocument {
  id: string;
  type:
    | 'BUYER_RECEIPT'
    | 'BRAND_SETTLEMENT_STATEMENT'
    | 'PLATFORM_COMMISSION_INVOICE'
    | 'CREDIT_NOTE';
  status: 'GENERATED' | 'VOIDED';
  documentNumber: string;
  paymentAttemptId?: string | null;
  payoutId?: string | null;
  orderId?: string | null;
  customOrderId?: string | null;
  currency: string;
  grossAmount: string;
  commissionAmount?: string | null;
  netAmount?: string | null;
  metadataJson?: Record<string, unknown> | null;
  contentHtml?: string | null;
  issuedAt: string;
  voidedAt?: string | null;
  emailSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFinanceOverview {
  currency: string;
  gmv: number;
  totalCommissions: number;
  totalPayouts: number;
  totalRefunds: number;
  activeCommissionRules: number;
  unresolvedReconciliationItems: number;
  pendingPayouts?: number;
  activeEscrowHolds?: number;
  settlementState?: AdminFinanceSettlementState | null;
  recentRuns: AdminReconciliationRun[];
  recentDocuments: AdminFinancialDocument[];
}

export interface AdminPaymentSettlementDetail {
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  orderId?: string | null;
  customOrderId?: string | null;
  brand?: { id: string; name: string | null } | null;
  grossAmount: number;
  commissionAmount: number;
  brandNetAmount: number;
  releaseMode: string | null;
  upfrontReleasePercent: number;
  upfrontReleasedAmount: number;
  finalHeldAmount: number;
  snapshotId: string | null;
  settlementPolicyId: string | null;
  commissionRuleId: string | null;
  releaseStatus: string;
}

export interface AdminFinancePaymentAttempt {
  id: string;
  reference: string;
  gateway: string;
  providerMode: 'mock' | 'live' | string;
  paymentMethod: string;
  channel?: string | null;
  status: string;
  amount: number;
  currency: string;
  settlementAmount: number;
  settlementCurrency: string;
  subjectType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | string;
  createdAt: string;
  confirmedAt?: string | null;
  lastVerifiedAt?: string | null;
  buyer?: {
    id: string;
    name: string;
    username?: string | null;
  } | null;
  brands: Array<{
    id: string;
    name: string | null;
  }>;
  orderCount: number;
  orders: Array<{
    id: string;
    type: 'ORDER' | 'CUSTOM_ORDER' | string;
    title: string;
  }>;
}

export interface AdminFinancePaymentDetail {
  id: string;
  reference: string;
  gateway: string;
  providerMode: string;
  paymentMethod: string;
  channel?: string | null;
  status: string;
  amount: number;
  currency: string;
  settlementAmount: number;
  settlementCurrency: string;
  subjectType: string;
  createdAt: string;
  confirmedAt?: string | null;
  lastVerifiedAt?: string | null;
  requestSnapshot?: Record<string, unknown> | null;
  responseSnapshot?: Record<string, unknown> | null;
  nextAction?: Record<string, unknown> | null;
  bankAccount?: Record<string, unknown> | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  buyer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  orders: Array<{
    id: string;
    customerName: string;
    totalAmount: string;
    currency: string;
    brand?: { id: string; name: string | null } | null;
  }>;
  customOrder?: {
    id: string;
    title?: string | null;
    sourceTitleSnapshot?: string | null;
    brand?: { id: string; name: string | null } | null;
    buyer?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
    } | null;
  } | null;
  settlementDetails?: AdminPaymentSettlementDetail[];
  events: Array<{
    id: string;
    type: string;
    source: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface AdminStalePaymentReconcileFailure {
  reference: string;
  reason: string;
}

export interface AdminStalePaymentReconcileResult {
  scanned: number;
  updated: number;
  skipped: string[];
  reconciled: string[];
  failed: AdminStalePaymentReconcileFailure[];
}

export interface AdminFinanceTransaction extends AdminLedgerTransaction {
  brand?: { id: string; name: string | null } | null;
  buyerName?: string | null;
  referenceTitle?: string | null;
}

export interface AdminEscrowHold {
  id: string;
  holdType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | string;
  referenceId?: string | null;
  title: string;
  brand?: { id: string; name: string | null } | null;
  buyerName?: string | null;
  currency: string;
  grossAmount: number;
  commissionAmount?: number;
  netBrandAmount?: number;
  releasedGrossAmount?: number;
  releasedNetAmount: number;
  heldGrossAmount?: number;
  heldNetAmount: number;
  status: string;
  nextReleaseAt?: string | null;
  releaseCondition?: string | null;
  frozenReason?: string | null;
  canManualRelease: boolean;
  createdAt: string;
}

export interface AdminLedgerEntry {
  id: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  balanceAfter: string;
  createdAt: string;
  account: {
    id: string;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
    subType: string;
    entityType?: string | null;
    entityId?: string | null;
  };
}

export interface AdminLedgerTransaction {
  id: string;
  type:
    | 'PAYMENT_RECEIVED'
    | 'ESCROW_RELEASE'
    | 'PAYOUT_DISBURSED'
    | 'REFUND_ISSUED'
    | 'REVERSAL';
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  totalAmount: string;
  currency: string;
  createdAt: string;
  entries: AdminLedgerEntry[];
}
