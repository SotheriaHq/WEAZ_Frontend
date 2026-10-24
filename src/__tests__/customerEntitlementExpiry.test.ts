import { describe, expect, it } from 'vitest';
import { customerEntitlementRemainingMs } from '@/lib/customerEntitlementExpiry';

describe('server-relative customer entitlement expiry', () => {
  const timing = {serverNow:'2026-10-23T10:00:00Z',entitlementExpiresAt:'2026-10-23T10:01:00Z'};
  it('uses elapsed receipt time even when the device calendar is years wrong', () => {
    const receipt = Date.parse('2030-01-01T00:00:00Z');
    expect(customerEntitlementRemainingMs(timing,receipt,receipt+15000)).toBe(45000);
    expect(customerEntitlementRemainingMs(timing,receipt,receipt+60000)).toBe(0);
    expect(customerEntitlementRemainingMs(timing,receipt,receipt+90000)).toBe(0);
  });
  it('cannot grant time using a malformed or missing server expiry', () => {
    expect(customerEntitlementRemainingMs({...timing,serverNow:'bad'},0,0)).toBeNull();
    expect(customerEntitlementRemainingMs({...timing,entitlementExpiresAt:null},0,0)).toBeNull();
  });
});
