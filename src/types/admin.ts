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
  role: 'SuperAdmin' | 'Admin';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: string;
  updatedAt: string;
  permissions?: { permissionCode: string }[];
}

export interface AdminBrand {
  id: string;
  name: string | null;
  ownerId?: string;
  isStoreOpen?: boolean;
  owner?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status?: string;
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
  isFeatured: boolean;
  price: string;
  salePrice: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  brand?: { id: string; name: string | null };
}

export interface AdminCollection {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  visibility: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; email: string; firstName: string; lastName: string };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug?: string;
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
