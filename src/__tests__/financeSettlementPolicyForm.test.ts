import { describe, expect, it } from 'vitest';
import {
  createEmptySettlementPolicyForm,
  normalizeSettlementPolicyFormValues,
  toSettlementPolicyPayload,
  validateSettlementPolicyForm,
} from '@/pages/admin/financeSettlementPolicyForm';

describe('finance settlement policy form helpers', () => {
  it('forces hold-until-delivery policies to disable upfront release and reset percent to zero', () => {
    const values = normalizeSettlementPolicyFormValues({
      ...createEmptySettlementPolicyForm(),
      releaseMode: 'HOLD_UNTIL_DELIVERY',
      upfrontReleaseEnabled: true,
      upfrontReleasePercent: '35',
    });

    expect(values.upfrontReleaseEnabled).toBe(false);
    expect(values.upfrontReleasePercent).toBe('0');

    const payload = toSettlementPolicyPayload(values);
    expect(payload.upfrontReleaseEnabled).toBe(false);
    expect(payload.upfrontReleasePercent).toBe(0);
  });

  it('allows split-release policies to enable upfront percent', () => {
    const values = normalizeSettlementPolicyFormValues({
      ...createEmptySettlementPolicyForm(),
      releaseMode: 'SPLIT_RELEASE',
      upfrontReleaseEnabled: true,
      upfrontReleasePercent: '60',
    });

    const validation = validateSettlementPolicyForm(values);
    expect(validation.errors.upfrontReleasePercent).toBeUndefined();

    const payload = toSettlementPolicyPayload(values);
    expect(payload.upfrontReleaseEnabled).toBe(true);
    expect(payload.upfrontReleasePercent).toBe(60);
  });
});
