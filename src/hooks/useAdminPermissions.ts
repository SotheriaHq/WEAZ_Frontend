import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { getStoredAccessToken } from '../api/httpClient';

const PERMISSION_ALIASES: Record<string, string> = {
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',
  USERS_WRITE: 'users.update',
  USERS_SUSPEND: 'users.deactivate',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_NOTIFY: 'notifications.send',
  BRANDS_READ: 'brands.read',
  BRANDS_VERIFY: 'brands.verify',
  BRANDS_SUSPEND: 'brands.suspend',
  BRANDS_STORE_OVERRIDE: 'brands.store_override',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_MODERATE: 'products.moderate',
  COLLECTIONS_READ: 'collections.read',
  COLLECTIONS_MODERATE: 'collections.moderate',
  TAXONOMY_READ: 'taxonomy.read',
  TAXONOMY_WRITE: 'taxonomy.write',
  TAGS_READ: 'tags.read',
  TAGS_MODERATE: 'tags.moderate',
  MEASUREMENTS_READ: 'measurements.read',
  MEASUREMENTS_REVIEW: 'measurements.review',
  PAYOUTS_READ: 'payouts.read',
  PAYOUTS_PROCESS: 'payouts.process',
  DISPUTES_READ: 'disputes.read',
  DISPUTES_RESOLVE: 'disputes.resolve',
  FEATURED_MANAGE: 'featured.manage',
  MODERATION_READ: 'moderation.read',
  MODERATION_REVIEW: 'moderation.write',
  AUDIT_READ: 'audit.read',
  MARKET_GOVERNANCE_READ: 'market.governance.read',
  MARKET_GOVERNANCE_WRITE: 'market.governance.write',
  MARKET_GOVERNANCE_RELEASE: 'market.governance.release',
  MARKET_RANKING_FORMULA_WRITE: 'market.ranking.formula.write',
  MARKET_RANKING_ROLLBACK: 'market.ranking.rollback',
  MARKET_SUGGESTIONS_WRITE: 'market.suggestions.write',
  SYSTEM_SLA_READ: 'system.sla.read',
  SYSTEM_SLA_WRITE: 'system.sla.write',
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
