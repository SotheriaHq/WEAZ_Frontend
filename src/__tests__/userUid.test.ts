import { describe, expect, it } from 'vitest';
import { generateUserUid } from '@/utils/userUid';

/**
 * The UID is rendered in the navbar, copied to clipboards, and read down the
 * phone to support. Its shape is a product decision — `WIE` + initial + digits
 * + `Z` — and the value must stay stable for a given account, because a UID
 * that changes between renders is worse than no UID at all.
 */
describe('generateUserUid', () => {
  it('opens with WIE, carries the account initial, and closes with Z', () => {
    const uid = generateUserUid('user-1', 'Jayden');

    expect(uid).toMatch(/^WIE[A-Z]\d{10}Z$/);
    expect(uid.startsWith('WIEJ')).toBe(true);
    expect(uid.endsWith('Z')).toBe(true);
  });

  it('is stable for the same account', () => {
    expect(generateUserUid('user-1', 'Jayden')).toBe(generateUserUid('user-1', 'Jayden'));
  });

  it('separates different accounts', () => {
    expect(generateUserUid('user-1', 'Jayden')).not.toBe(generateUserUid('user-2', 'Jayden'));
  });

  /*
    A brand owner may have no first name on the record, and a display name can
    start with a digit, an emoji, or a non-Latin letter. The slot is a single
    A-Z character, so anything that cannot fill it becomes 'X' rather than
    producing a UID that fails its own format.
  */
  it.each([
    ['', 'missing name'],
    ['   ', 'blank name'],
    ['9Lives', 'leading digit'],
    ['🔥Brand', 'leading emoji'],
    ['真', 'non-Latin script'],
  ])('falls back to X for %s (%s)', (firstName) => {
    const uid = generateUserUid('user-3', firstName);

    expect(uid).toMatch(/^WIE[A-Z]\d{10}Z$/);
    expect(uid.charAt(3)).toBe('X');
  });

  it('lowercases are raised to the initial slot', () => {
    expect(generateUserUid('user-4', 'nuel').charAt(3)).toBe('N');
  });

  it('keeps the 15-character width the layouts were built around', () => {
    expect(generateUserUid('user-5', 'Shawn')).toHaveLength(15);
  });
});
