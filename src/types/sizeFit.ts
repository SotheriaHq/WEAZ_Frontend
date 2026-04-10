export type SizeFitVisibility = 'PUBLIC' | 'PRIVATE';
export type SizeFitSharePolicy = 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
export type SizeFitShareStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
export type LengthUnit = 'CM' | 'IN';
export type WeightUnit = 'KG' | 'LBS';
export type FitPreference = 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';

export interface BaselineMeasurementPoint {
  key: string;
  label: string;
  description?: string | null;
  category: string;
  minValueCm?: number | null;
  maxValueCm?: number | null;
  required: boolean;
}

export interface SizeFitProfile {
  id: string;
  userId: string;
  visibility: SizeFitVisibility;
  sharePolicy: SizeFitSharePolicy;
  notifyOnShare: boolean;
  requireUpdateEveryDays: number;
  version: number;
  preferredLengthUnit: LengthUnit;
  preferredWeightUnit: WeightUnit;
  fitPreference: FitPreference | null;
  label: string;
  measurements: Record<string, unknown>;
  measurementGender?: 'MEN' | 'WOMEN';
  baselineMeasurementPoints?: BaselineMeasurementPoint[];
  baselineRequiredKeys?: string[];
  missingBaselineKeys?: string[];
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
  targetUserIdentifier: string;
  targetUserId?: string;
  canReshare?: boolean;
  note?: string;
}

export interface SizeFitSharesPayload {
  incoming: Array<Record<string, unknown>>;
  outgoing: Array<Record<string, unknown>>;
  sharesGiven: Array<Record<string, unknown>>;
  sharesReceived: Array<Record<string, unknown>>;
}

