import type {
  AgeGroup,
  FitPreference,
  MeasurementPoint,
  MeasurementUnit,
  OrderSizingSnapshot,
  SizingMode,
} from '@/types/sizing';

const conversions: Record<string, number> = {
  cm_in: 0.3937007874,
  in_cm: 2.54,
  kg_lb: 2.2046226218,
  lb_kg: 0.45359237,
};

export function convertUnit(
  value: number,
  from: 'cm' | 'in' | 'kg' | 'lb',
  to: 'cm' | 'in' | 'kg' | 'lb',
): number {
  if (from === to) return value;
  return value * (conversions[`${from}_${to}`] ?? 1);
}

export function formatMeasurement(value: number, unit: string, decimals = 1): string {
  if (unit.toLowerCase() === 'in') {
    const halfInch = Math.round(value * 2) / 2;
    return `${halfInch}\"`;
  }

  if (unit.toLowerCase() === 'lb' || unit.toLowerCase() === 'lbs') {
    return `${Math.round(value)} lb`;
  }

  return `${value.toFixed(decimals)} ${unit}`;
}

export function validateMeasurement(
  key: string,
  value: number,
  ageGroup: AgeGroup,
  points: MeasurementPoint[],
): { valid: boolean; error?: string } {
  const point = points.find((entry) => entry.key === key);
  if (!point) {
    return { valid: false, error: 'Unknown measurement point' };
  }

  const min =
    ageGroup === 'CHILD'
      ? (point.minValueChildCm ?? point.minValueCm ?? null)
      : (point.minValueCm ?? null);
  const max =
    ageGroup === 'CHILD'
      ? (point.maxValueChildCm ?? point.maxValueCm ?? null)
      : (point.maxValueCm ?? null);

  if (min != null && value < min) {
    return { valid: false, error: `${point.label} must be at least ${min} cm` };
  }

  if (max != null && value > max) {
    return { valid: false, error: `${point.label} must be at most ${max} cm` };
  }

  return { valid: true };
}

export function buildSizeFitSnapshot(
  formValues: Record<string, number>,
  requiredKeys: string[],
  options: {
    selectedSize?: string;
    fitPreference?: FitPreference;
    fitPreferenceSource?: 'BRAND' | 'BUYER';
    profileId?: string;
    mode: SizingMode;
  },
): OrderSizingSnapshot {
  const measurements: Record<string, { value: number; unit: MeasurementUnit }> = {};

  for (const key of requiredKeys) {
    const value = formValues[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      measurements[key] = {
        value,
        unit: 'CM',
      };
    }
  }

  return {
    mode: options.mode,
    selectedSize: options.selectedSize,
    fitPreference: options.fitPreference,
    fitPreferenceSource: options.fitPreferenceSource,
    profileId: options.profileId,
    requiredMeasurementKeys: requiredKeys,
    measurements,
  };
}

export function setWithTTL<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;

  const payload = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  localStorage.setItem(key, JSON.stringify(payload));
}

export function getWithTTL<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { value: T; expiresAt: number };
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
