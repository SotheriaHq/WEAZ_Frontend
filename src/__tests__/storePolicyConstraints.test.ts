import { describe, expect, it } from 'vitest';
import {
  getStorePoliciesStepValidation,
  sanitizeCustomOrderLeadTime,
  sanitizeResponseTimeSla,
  sanitizeReturnWindow,
  sanitizeShippingRegions,
} from '@/utils/storePolicyConstraints';

describe('storePolicyConstraints', () => {
  it('removes international and keeps explicit countries', () => {
    expect(sanitizeShippingRegions(['nigeria', 'international', 'ghana'])).toEqual([
      'nigeria',
      'ghana',
    ]);
  });

  it('limits return windows to 7 or 14 days', () => {
    expect(sanitizeReturnWindow('30')).toBe('14');
    expect(sanitizeReturnWindow('7')).toBe('7');
  });

  it('limits response SLA to 24 hours max', () => {
    expect(sanitizeResponseTimeSla('48h')).toBe('24h');
    expect(sanitizeResponseTimeSla('24h')).toBe('24h');
  });

  it('limits custom-order lead time to 7 days and maps legacy values', () => {
    expect(sanitizeCustomOrderLeadTime('14-21')).toBe('4-7');
    expect(sanitizeCustomOrderLeadTime('2-4')).toBe('2-4');
    expect(sanitizeCustomOrderLeadTime('30-plus')).toBe('4-7');
  });

  it('blocks policies continue until required fields are present', () => {
    const incomplete = getStorePoliciesStepValidation({
      shippingRegions: [],
      processingTime: '',
      shippingMethods: [],
      freeShippingThreshold: null,
      returnsAccepted: true,
      returnWindow: '30',
      refundMethod: '',
      responseTimeSla: '48h',
      contactEmail: '',
      customOrdersEnabled: true,
      customOrderLeadTime: '2-4',
    });

    expect(incomplete.valid).toBe(false);
    expect(incomplete.missing.length).toBeGreaterThan(0);
  });
});