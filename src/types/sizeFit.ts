export type SizeFitVisibility = 'PUBLIC' | 'PRIVATE';
export type SizeFitSharePolicy = 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
export type SizeFitShareStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
export type LengthUnit = 'CM' | 'IN';
export type WeightUnit = 'KG' | 'LBS';
export type FitPreference = 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';
export type SizingRegion = 'NG_WEST_AFRICA' | 'UK' | 'US' | 'EU' | 'INTERNATIONAL';
export type RecommendationConfidenceLabel = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
export type GarmentCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'GOWN'
  | 'DRESS'
  | 'FORMAL_SHIRT'
  | 'JACKET'
  | 'SKIRT'
  | 'UNISEX_TOP'
  | 'UNISEX_BOTTOM'
  | 'OTHER';

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
  preferredSizingRegion?: SizingRegion;
  canonicalMeasurements?: Record<string, number>;
  unmappedMeasurements?: Record<string, unknown>;
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

export interface SizeRecommendationResponse {
  estimatedSize: string | null;
  recommendedSize: string | null;
  displayRange: string | null;
  alternativeSize: string | null;
  confidenceScore: number;
  confidenceLabel: RecommendationConfidenceLabel;
  reasons: string[];
  warnings: string[];
  chartSource: string | null;
  chartVersion: number | null;
  chartId?: string | null;
  chartVersionId?: string | null;
  selectedRegion: SizingRegion;
  garmentCategory: GarmentCategory;
  manualOverrideAllowed: boolean;
  missingMeasurements: string[];
  usedMeasurements: string[];
  fallbackUsed: boolean;
  staleMeasurementWarning?: boolean;
  sizeChartUnavailable?: boolean;
  normalizedMeasurements?: Record<string, number>;
  userFitPreference?: FitPreference | string | null;
  productFitType?: string | null;
  fabricStretch?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | null;
}

export interface ComputedSizeFitProfile {
  estimatedSize: string | null;
  displayRange: string | null;
  confidenceScore: number;
  confidenceLabel: RecommendationConfidenceLabel;
  preferredRegion: SizingRegion;
  preferredUnit: LengthUnit;
  fitPreference: FitPreference | null;
  categoryBreakdown: Record<string, SizeRecommendationResponse>;
  missingBaselineMeasurements: string[];
  staleMeasurementWarning?: boolean;
  measurementUpdatePrompt?: {
    requiredMeasurements: string[];
    missingMeasurements: string[];
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

