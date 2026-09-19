import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { getStoredAccessToken } from '../api/httpClient';
import { ADMIN_PERMISSION_CODE_BY_KEY } from '@/constants/adminPermissions';

/**
 * Keys that do not match a catalogue entry's name and so cannot be derived.
 * They are kept because call sites still pass them.
 */
const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
  USERS_WRITE: 'users.update',
  USERS_SUSPEND: 'users.deactivate',
  USERS_NOTIFY: 'notifications.send',
  MODERATION_REVIEW: 'moderation.write',
};

/**
 * `USERS_READ` → `users.read`. Derived from the catalogue rather than
 * hand-written: this map used to be maintained by hand and had fallen eight
 * codes behind the backend, and because `hasPermission` falls back to the raw
 * key when a code is missing, every one of those checks silently returned false
 * instead of erroring.
 */
const PERMISSION_ALIASES: Record<string, string> = {
  ...ADMIN_PERMISSION_CODE_BY_KEY,
  ...LEGACY_PERMISSION_ALIASES,
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function useAdminPermissions() {
  const { profile } = useSelector((state: RootState) => state.user);

  const permissions = useMemo<string[]>(() => {
    if (!profile) return [];
    const token = getStoredAccessToken();
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.permissions && Array.isArray(payload.permissions)) {
        return payload.permissions as string[];
      }
    }
    return [];
  }, [profile]);

  const isAdmin = profile?.role === 'SuperAdmin' || profile?.role === 'Admin';
  const isSuperAdmin = profile?.role === 'SuperAdmin';

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (!isAdmin) return false;
      if (isSuperAdmin) return true;
      const normalized = PERMISSION_ALIASES[code] ?? code;
      return permissions.includes(normalized);
    },
    [isAdmin, isSuperAdmin, permissions],
  );

  return useMemo(
    () => ({ permissions, isAdmin, isSuperAdmin, hasPermission }),
    [permissions, isAdmin, isSuperAdmin, hasPermission],
  );
}
