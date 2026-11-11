import { describe, expect, it } from 'vitest';
import { scrubSecurityTelemetry } from './securityTelemetry';

describe('MFA telemetry privacy', () => {
  it('removes secrets from nested and serialized Axios data without removing diagnostic status', () => {
    const report = { request: { url: '/auth/security/mfa/totp/begin', headers: {
      Authorization: 'Bearer private', 'x-wiez-action-proof': 'private-proof', 'Content-Type': 'application/json',
    }, data: JSON.stringify({ password: 'private-password', enrollmentProof: 'private-enrollment' }) },
    extra: { response: { status: 400, data: { secret: 'private-seed', uri: 'otpauth://totp/private', recoveryCodes: ['backup'] } },
      evidenceReference: 'private-case-reference' } };
    const redacted = scrubSecurityTelemetry(report);
    const encoded = JSON.stringify(redacted);
    for (const secret of ['private-password', 'private-enrollment', 'private-proof', 'private-seed', 'backup', 'private-case-reference'])
      expect(encoded).not.toContain(secret);
    expect(redacted.extra.response.status).toBe(400);
    expect(redacted.request.headers['Content-Type']).toBe('application/json');
    expect(report.request.data).toContain('private-password');
  });
  it('redacts free-text authenticator URIs, backup codes and one-use proofs', () => {
    const proof = `11111111-1111-4111-8111-111111111111.${'A'.repeat(43)}`;
    const input = `Failed ${proof} otpauth://totp/hello?secret=PRIVATE 1234-ABCD-1234-ABCD-1234-ABCD-1234-ABCD code is 12345678`;
    expect(scrubSecurityTelemetry(input)).not.toMatch(/PRIVATE|12345678|1234-ABCD|AAAAAAAA/);
  });
  it('fails closed for cyclic/deep extra values', () => {
    const value: { nested?: unknown } = {}; value.nested = value;
    expect(JSON.stringify(scrubSecurityTelemetry(value))).toContain('redacted-depth-limit');
  });
  it('does not retain oversized serialized request bodies', () => {
    expect(scrubSecurityTelemetry(JSON.stringify({ padding: 'X'.repeat(66000), password: 'private' }))).toBe('<redacted-oversize-value>');
  });
});
