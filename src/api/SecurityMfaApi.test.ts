import { describe, expect, it, vi } from 'vitest';
import { parseMfaStatus } from './SecurityMfaApi';
vi.mock('./httpClient', () => ({ apiClient: {} }));
const status = { factors: [{ id: '11111111-1111-4111-8111-111111111111', kind: 'PASSKEY', label: 'My phone',
  createdAt: '2026-11-02T00:00:00Z', verifiedAt: '2026-11-02T00:00:00Z' }], recoveryCodesRemaining: 10,
  readVerificationSeconds: 300, setup: { hasPassword: true, emailVerified: true }, passkeys: { webConfigured: true, androidConfigured: false } };
describe('MFA status boundary', () => {
  it('accepts real empty and verified-method states, wrapped or direct', () => {
    expect(parseMfaStatus({ data: status })).toEqual(status);
    expect(parseMfaStatus({ ...status, factors: [], recoveryCodesRemaining: 0 }).factors).toEqual([]);
  });
  it.each([null, {}, { ...status, passkeys: undefined }, { ...status, factors: [status.factors[0], status.factors[0]] },
    { ...status, factors: [{ ...status.factors[0], id: 'invalid' }] }, { ...status, factors: [{ ...status.factors[0], kind: 'UNKNOWN' }] },
    { ...status, recoveryCodesRemaining: 11 }, { ...status, recoveryCodesRemaining: -1 }, { ...status, readVerificationSeconds: 999 },
    { ...status, factors: [{ ...status.factors[0], verifiedAt: 'invalid' }] }, { ...status, setup: {} }])(
    'rejects malformed authority state rather than rendering enabled controls: %#', value => {
      expect(() => parseMfaStatus(value)).toThrow('incomplete verification status');
    });
});
