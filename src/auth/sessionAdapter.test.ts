import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSessionStorageAdapter } from './sessionAdapter';

describe('WebSessionStorageAdapter — AUTH-T01 through AUTH-T08 Contract Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('AUTH-T01: Fresh App Installation returns null with storage unset', () => {
    const token = WebSessionStorageAdapter.getAccessToken();
    expect(token).toBeNull();
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
  });

  it('AUTH-T02: Fresh User Sign-In writes only to primary key and purges legacy keys', () => {
    const success = WebSessionStorageAdapter.setAccessToken('aru-token-alpha');
    expect(success).toBe(true);
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBe('aru-token-alpha');
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
    expect(localStorage.getItem('THREADLY_ACCESS_TOKEN')).toBeNull();
  });

  it('AUTH-T03: Legacy User Upgrade Migration migrates WIEZ token to ARU and purges legacy key', () => {
    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'legacy-wiez-token-123');
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBeNull();

    const migrated = WebSessionStorageAdapter.getAccessToken();
    expect(migrated).toBe('legacy-wiez-token-123');
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBe('legacy-wiez-token-123');
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
  });

  it('AUTH-T04: Token Refresh & Rotation updates primary key without touching legacy key', () => {
    WebSessionStorageAdapter.setAccessToken('aru-token-initial');
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBe('aru-token-initial');

    const updated = WebSessionStorageAdapter.setAccessToken('aru-token-rotated');
    expect(updated).toBe(true);
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBe('aru-token-rotated');
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
  });

  it('AUTH-T05: Explicit User Logout purges all primary, legacy, and historical keys', () => {
    localStorage.setItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY, 'aru-token-current');
    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'wiez-token-legacy');
    localStorage.setItem('THREADLY_ACCESS_TOKEN', 'threadly-token-historical');
    localStorage.setItem(WebSessionStorageAdapter.PRIMARY_USER_KEY, JSON.stringify({ id: 'u1' }));
    localStorage.setItem('WIEZ_USER', JSON.stringify({ id: 'u1' }));

    const result = WebSessionStorageAdapter.clearSession();
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();
    expect(localStorage.getItem('THREADLY_ACCESS_TOKEN')).toBeNull();
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_USER_KEY)).toBeNull();
    expect(localStorage.getItem('WIEZ_USER')).toBeNull();
  });

  it('AUTH-T06: Durable Write Interruption Simulation preserves legacy token when primary write fails', () => {
    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'legacy-protected-token');

    // Simulate primary write failure (e.g. quota exceeded)
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      if (key === WebSessionStorageAdapter.PRIMARY_TOKEN_KEY) {
        throw new Error('QuotaExceededError');
      }
      originalSetItem(key, val);
    });

    const token = WebSessionStorageAdapter.getAccessToken();
    // Must return the legacy token without losing it
    expect(token).toBe('legacy-protected-token');
    // Legacy key must NOT be deleted
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBe('legacy-protected-token');
    // Primary key was not persisted
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBeNull();
  });

  it('AUTH-T07: Legacy Deletion Failure Handling retains primary credential and logs warning', () => {
    localStorage.setItem('WIEZ_ACCESS_TOKEN', 'legacy-token-undeletable');

    // Simulate legacy deletion failure
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      if (key === 'WIEZ_ACCESS_TOKEN') {
        throw new Error('DiskIOError');
      }
      originalRemoveItem(key);
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const token = WebSessionStorageAdapter.getAccessToken();
    expect(token).toBe('legacy-token-undeletable');
    // Primary key was persisted
    expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY)).toBe('legacy-token-undeletable');
    // Warning logged about failed deletion
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete legacy key WIEZ_ACCESS_TOKEN'),
    );
  });

  it('AUTH-T08: Emergency Binary Downgrade finds null legacy key after migration and initiates clean login', () => {
    // 1. App runs migrated version and purges legacy key
    WebSessionStorageAdapter.setAccessToken('aru-migrated-token');
    expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBeNull();

    // 2. Simulated downgraded binary checks only legacy key
    const legacyKeyInOldBinary = 'WIEZ_ACCESS_TOKEN';
    const oldBinaryToken = localStorage.getItem(legacyKeyInOldBinary);
    expect(oldBinaryToken).toBeNull();
    // Evaluates to clean null; user can log in without replay errors or app crash
  });

  describe('Extended Precedence & Security Durability Scenarios (Section 4)', () => {
    it('Dual-key precedence: matching credentials returns ARU primary', () => {
      localStorage.setItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY, 'tok-matched');
      localStorage.setItem('WIEZ_ACCESS_TOKEN', 'tok-matched');
      const token = WebSessionStorageAdapter.getAccessToken();
      expect(token).toBe('tok-matched');
    });

    it('Dual-key precedence: conflicting credentials returns ARU primary (ARU precedence)', () => {
      localStorage.setItem(WebSessionStorageAdapter.PRIMARY_TOKEN_KEY, 'tok-aru-fresh');
      localStorage.setItem('WIEZ_ACCESS_TOKEN', 'tok-wiez-stale');
      const token = WebSessionStorageAdapter.getAccessToken();
      expect(token).toBe('tok-aru-fresh');
    });

    it('Dual-key precedence: invalid primary user profile drops invalid ARU and recovers valid legacy', () => {
      localStorage.setItem(WebSessionStorageAdapter.PRIMARY_USER_KEY, '{not-valid-json');
      localStorage.setItem('WIEZ_USER', JSON.stringify({ id: 'user-legacy-recovered' }));
      const user = WebSessionStorageAdapter.getUserProfile();
      expect(user).toBe(JSON.stringify({ id: 'user-legacy-recovered' }));
      expect(localStorage.getItem(WebSessionStorageAdapter.PRIMARY_USER_KEY)).toBe(
        JSON.stringify({ id: 'user-legacy-recovered' }),
      );
    });

    it('Dual-key precedence: valid primary user profile ignores corrupt legacy key', () => {
      localStorage.setItem(WebSessionStorageAdapter.PRIMARY_USER_KEY, JSON.stringify({ id: 'user-aru-valid' }));
      localStorage.setItem('WIEZ_USER', '{corrupt-legacy-data');
      const user = WebSessionStorageAdapter.getUserProfile();
      expect(user).toBe(JSON.stringify({ id: 'user-aru-valid' }));
    });

    it('Read-back verification failure: prevents legacy key deletion', () => {
      localStorage.setItem('WIEZ_ACCESS_TOKEN', 'tok-legacy-precious');
      const originalGetItem = localStorage.getItem.bind(localStorage);
      let setCalled = false;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
        if (key === WebSessionStorageAdapter.PRIMARY_TOKEN_KEY) setCalled = true;
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
        if (key === WebSessionStorageAdapter.PRIMARY_TOKEN_KEY && setCalled) {
          return 'corrupted-readback-mismatch';
        }
        return originalGetItem(key);
      });

      const token = WebSessionStorageAdapter.getAccessToken();
      expect(token).toBe('tok-legacy-precious');
      expect(localStorage.getItem('WIEZ_ACCESS_TOKEN')).toBe('tok-legacy-precious');
    });

    it('Credential confidentiality: tokens and secrets are never logged in console or errors', () => {
      const sensitiveToken = 'sensitive-secret-token-xyz-987';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      WebSessionStorageAdapter.setAccessToken(sensitiveToken);
      WebSessionStorageAdapter.getAccessToken();

      const allLoggedMessages = [
        ...logSpy.mock.calls.flat(),
        ...warnSpy.mock.calls.flat(),
        ...errorSpy.mock.calls.flat(),
      ].join(' ');

      expect(allLoggedMessages).not.toContain(sensitiveToken);
    });
  });
});
