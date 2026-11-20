/**
 * ARU Product Identity Migration — Canonical Web Session Storage Adapter
 * Governed by Document 26 (ARU-P1-CTR-026-REV2).
 * Implements Hardened Dual-Read, Single-Write with Verified Durable Retirement.
 */

export class WebSessionStorageAdapter {
  static readonly PRIMARY_TOKEN_KEY = 'ARU_ACCESS_TOKEN';
  static readonly LEGACY_TOKEN_KEYS = ['WIEZ_ACCESS_TOKEN', 'THREADLY_ACCESS_TOKEN'];
  static readonly PRIMARY_USER_KEY = 'ARU_USER';
  static readonly LEGACY_USER_KEYS = ['WIEZ_USER', 'THREADLY_USER'];

  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Read primary ARU token
      const primary = window.localStorage.getItem(this.PRIMARY_TOKEN_KEY);
      if (primary) return primary;

      // 2. Read legacy fallback
      for (const legacyKey of this.LEGACY_TOKEN_KEYS) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          // Durable migration: Write primary first in guarded try/catch
          try {
            window.localStorage.setItem(this.PRIMARY_TOKEN_KEY, legacy);
            // Verify write succeeded before deleting legacy
            if (window.localStorage.getItem(this.PRIMARY_TOKEN_KEY) === legacy) {
              try {
                window.localStorage.removeItem(legacyKey);
              } catch {
                console.warn(`[AuthMigration] Failed to delete legacy key ${legacyKey}; retained for retry.`);
              }
            }
          } catch {
            console.warn(`[AuthMigration] Primary key write failed for ${this.PRIMARY_TOKEN_KEY}; returning legacy credentials without migration.`);
          }
          return legacy;
        }
      }
      return null;
    } catch {
      console.error('[AuthMigration] Error accessing localStorage during getAccessToken.');
      return null;
    }
  }

  static setAccessToken(token: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      // 1. Write primary
      window.localStorage.setItem(this.PRIMARY_TOKEN_KEY, token);
      // 2. Verify write
      if (window.localStorage.getItem(this.PRIMARY_TOKEN_KEY) !== token) {
        throw new Error('Verification of written token failed.');
      }
      // 3. Purge legacy keys
      for (const legacyKey of this.LEGACY_TOKEN_KEYS) {
        try {
          window.localStorage.removeItem(legacyKey);
        } catch {
          console.warn(`[AuthMigration] Non-fatal legacy token deletion failure for ${legacyKey}.`);
        }
      }
      return true;
    } catch {
      console.error('[AuthMigration] Failed to persist primary token.');
      return false;
    }
  }

  static getUserProfile(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Read primary ARU user
      const primary = window.localStorage.getItem(this.PRIMARY_USER_KEY);
      if (primary) {
        try {
          JSON.parse(primary);
          return primary;
        } catch {
          window.localStorage.removeItem(this.PRIMARY_USER_KEY);
        }
      }

      // 2. Read legacy fallback
      for (const legacyKey of this.LEGACY_USER_KEYS) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          try {
            JSON.parse(legacy);
          } catch {
            // Corrupt non-JSON data must not be migrated or treated as valid profile snapshot
            return null;
          }
          try {
            window.localStorage.setItem(this.PRIMARY_USER_KEY, legacy);
            if (window.localStorage.getItem(this.PRIMARY_USER_KEY) === legacy) {
              try {
                window.localStorage.removeItem(legacyKey);
              } catch {
                console.warn(`[AuthMigration] Failed to delete legacy key ${legacyKey}; retained for retry.`);
              }
            }
          } catch {
            console.warn(`[AuthMigration] Primary key write failed for ${this.PRIMARY_USER_KEY}; returning legacy user without migration.`);
          }
          return legacy;
        }
      }
      return null;
    } catch {
      console.error('[AuthMigration] Error accessing localStorage during getUserProfile.');
      return null;
    }
  }

  static setUserProfile(raw: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(this.PRIMARY_USER_KEY, raw);
      if (window.localStorage.getItem(this.PRIMARY_USER_KEY) !== raw) {
        throw new Error('Verification of written user profile failed.');
      }
      for (const legacyKey of this.LEGACY_USER_KEYS) {
        try {
          window.localStorage.removeItem(legacyKey);
        } catch {
          console.warn(`[AuthMigration] Non-fatal legacy user deletion failure for ${legacyKey}.`);
        }
      }
      return true;
    } catch {
      console.error('[AuthMigration] Failed to persist primary user.');
      return false;
    }
  }

  static clearSession(): { success: boolean; errors: string[] } {
    if (typeof window === 'undefined') return { success: true, errors: [] };
    const errors: string[] = [];
    const allKeys = [
      this.PRIMARY_TOKEN_KEY,
      this.PRIMARY_USER_KEY,
      ...this.LEGACY_TOKEN_KEYS,
      ...this.LEGACY_USER_KEYS,
    ];

    for (const key of allKeys) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        errors.push(`Failed to remove ${key}: ${String(err)}`);
      }
    }
    if (errors.length > 0) {
      console.error('[AuthMigration] Incomplete session clear in localStorage:', errors);
    }
    return { success: errors.length === 0, errors };
  }
}
