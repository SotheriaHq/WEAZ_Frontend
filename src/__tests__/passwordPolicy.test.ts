import { describe, expect, it } from 'vitest';
import {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
  isPasswordLengthValid,
} from '../lib/passwordPolicy';

describe('passwordPolicy', () => {
  it('uses a unicode-safe length check and shared policy copy', () => {
    expect(getPasswordLength('a🙂b')).toBe(3);
    expect(isPasswordLengthValid('x'.repeat(PASSWORD_POLICY_MIN_LENGTH))).toBe(true);
    expect(isPasswordLengthValid('short')).toBe(false);
    expect(getPasswordPolicyErrorMessage('New password')).toBe(
      `New password must be at least ${PASSWORD_POLICY_MIN_LENGTH} characters long.`,
    );
    expect(PASSWORD_POLICY_HINT).toContain(String(PASSWORD_POLICY_MIN_LENGTH));
  });
});