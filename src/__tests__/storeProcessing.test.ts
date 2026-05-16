import { describe, expect, it } from 'vitest';
import {
  deriveProductionLeadDaysFromStoreTime,
  getStoreProcessingTimeLabel,
} from '@/utils/storeProcessing';

describe('store processing helpers', () => {
  it('maps store setup processing labels to product/custom-order lead days', () => {
    expect(getStoreProcessingTimeLabel('7-14')).toBe('7-14 business days');
    expect(deriveProductionLeadDaysFromStoreTime('7-14')).toBe('14');
  });

  it('falls back to the editor default when processing time is not configured', () => {
    expect(getStoreProcessingTimeLabel('')).toBe('');
    expect(deriveProductionLeadDaysFromStoreTime('')).toBe('7');
  });
});
