export type SizingMode = 'NONE' | 'RTW' | 'CUSTOM' | 'RTW_PLUS_CUSTOM';
export type FitPreference = 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';
export type AgeGroup = 'ADULT' | 'CHILD';
export type MeasurementUnit = 'CM' | 'IN';
export type WeightUnit = 'KG' | 'LBS';

export type MeasurementPointCategory =
  | 'UPPER_BODY'
  | 'ARMS'
  | 'LOWER_BODY'
  | 'LENGTH'
  | 'GENERAL'
  | 'ACCESSORIES';

export type MeasurementPointSource = 'SYSTEM' | 'BRAND_FREEFORM';

export interface MeasurementPoint {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  category: MeasurementPointCategory;
  gender?: 'MEN' | 'WOMEN' | 'UNISEX' | null;
  source: MeasurementPointSource;
  status?: 'BRAND_ONLY' | 'APPROVED_GLOBAL' | 'REJECTED';
  brandId?: string | null;
  minValueCm?: number | null;
  maxValueCm?: number | null;
  minValueChildCm?: number | null;
  maxValueChildCm?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ContentSizing {
  sizingMode: SizingMode;
  rtwSizeSystem?: string;
  rtwSizeType?: 'PREDEFINED' | 'FREEFORM' | 'MIXED';
  rtwLinkedToInventory?: boolean;
  customGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  customMeasurementKeys?: string[];
  customFreeformPointIds?: string[];
  fitPreference?: FitPreference;
  targetAgeGroup?: AgeGroup;
}

export interface OrderSizingSnapshot {
  mode: SizingMode;
  measurements?: Record<string, { value: number; unit: MeasurementUnit }>;
  selectedSize?: string;
  fitPreference?: FitPreference;
  fitPreferenceSource?: 'BRAND' | 'BUYER';
  profileId?: string;
  requiredMeasurementKeys?: string[];
  brandSizeChartVersion?: number;
}
