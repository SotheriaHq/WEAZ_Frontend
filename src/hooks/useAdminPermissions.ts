import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { getStoredAccessToken } from '../api/httpClient';

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

  const hasPermission = (code: string): boolean => {
    if (!isAdmin) return false;
    if (isSuperAdmin) return true;
    return permissions.includes(code);
  };

  return { permissions, isAdmin, isSuperAdmin, hasPermission };
}
