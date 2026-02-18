export type SizeFitVisibility = 'PUBLIC' | 'PRIVATE';
export type SizeFitSharePolicy = 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
export type SizeFitShareStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export interface SizeFitProfile {
  id: string;
  userId: string;
  visibility: SizeFitVisibility;
  sharePolicy: SizeFitSharePolicy;
  notifyOnShare: boolean;
  requireUpdateEveryDays: number;
  measurements: Record<string, unknown>;
  notes: string;
  lastUpdatedAt: string | null;
  nextReminderAt: string | null;
  isUpdateDue: boolean;
  latestRevision?: {
    version: number;
    changedKeys: string[];
    createdAt: string | null;
  } | null;
  counters?: {
    incomingPendingShareRequests: number;
    outgoingPendingShareRequests: number;
    sharedWithMeCount: number;
  };
}

export interface SizeFitShareDto {
  profileUserId?: string;
  targetUserId: string;
  canReshare?: boolean;
  note?: string;
}

export interface SizeFitSharesPayload {
  incoming: Array<Record<string, unknown>>;
  outgoing: Array<Record<string, unknown>>;
  sharesGiven: Array<Record<string, unknown>>;
  sharesReceived: Array<Record<string, unknown>>;
}

