import { describe, expect, it } from 'vitest';
import { buildSizeFitSnapshot, convertUnit, formatMeasurement, validateMeasurement } from '@/utils/sizing';
import type { MeasurementPoint } from '@/types/sizing';

describe('sizing utils', () => {
  it('converts between cm and in', () => {
    const inches = convertUnit(10, 'cm', 'in');
    expect(inches).toBeCloseTo(3.937, 3);

    const centimeters = convertUnit(inches, 'in', 'cm');
    expect(centimeters).toBeCloseTo(10, 3);
  });

  it('formats inches to nearest half', () => {
    expect(formatMeasurement(35.26, 'in')).toBe('35.5"');
    expect(formatMeasurement(90.5, 'cm')).toBe('90.5 cm');
  });

  it('validates measurement ranges by age group', () => {
    const points: MeasurementPoint[] = [
      {
        id: '1',
        key: 'NECK',
        label: 'Neck',
        category: 'UPPER_BODY',
        source: 'SYSTEM',
        minValueCm: 20,
        maxValueCm: 55,
        minValueChildCm: 15,
        maxValueChildCm: 40,
      },
    ];

    expect(validateMeasurement('NECK', 25, 'ADULT', points).valid).toBe(true);
    expect(validateMeasurement('NECK', 14, 'CHILD', points).valid).toBe(false);
  });

  it('builds order sizing snapshot from required keys', () => {
    const snapshot = buildSizeFitSnapshot(
      {
        NECK: 40,
        WAIST: 85,
        EXTRA: 99,
      },
      ['NECK', 'WAIST'],
      {
        mode: 'RTW_PLUS_FITTINGS',
        selectedSize: 'M',
        fitPreference: 'REGULAR',
        fitPreferenceSource: 'BUYER',
      },
    );

    expect(snapshot.mode).toBe('RTW_PLUS_FITTINGS');
    expect(snapshot.selectedSize).toBe('M');
    expect(snapshot.measurements?.NECK?.value).toBe(40);
    expect(snapshot.measurements?.EXTRA).toBeUndefined();
  });
});
