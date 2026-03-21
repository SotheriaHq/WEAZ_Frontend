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
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  reference: string | null;
  createdAt: string;
  brand?: { id: string; name: string };
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

export interface AdminTagItem {
  name: string;
  usageCount: number;
}

export interface AdminDispute {
  id: string;
  type: 'ORDER' | 'PRODUCT' | 'SIZING' | 'GENERAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  description: string;
  reporterId: string;
  assignedToId: string | null;
  resolvedById: string | null;
  resolution: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
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
