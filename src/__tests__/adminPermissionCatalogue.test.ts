import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_CATALOGUE,
  ALL_ADMIN_PERMISSION_CODES,
  describeAdminPermission,
  isSuperAdminOnlyPermission,
} from '@/constants/adminPermissions';
import { canAccessAdminPath } from '@/components/admin/adminNavigation';

/**
 * The backend owns admin permissions; this repo owns their wording. The two
 * cannot import each other (separate repos), and a comment saying "keep these in
 * sync" had already failed — the web list had drifted to 47 of the 55 real
 * codes, and the eight missing ones were simply not grantable from the UI.
 *
 * So this reads the sibling repo's source and compares it. It SKIPS with a
 * printed reason when the sibling is not checked out, so a standalone clone of
 * the frontend still passes.
 */
const BACKEND_PERMISSIONS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../bthreadly/src/admin/constants/permissions.ts',
);

const sliceBetween = (source: string, start: string, end: string): string => {
  const from = source.indexOf(start);
  if (from === -1) return '';
  const after = from + start.length;
  const to = source.indexOf(end, after);
  return to === -1 ? '' : source.slice(after, to);
};

const readBackendPermissions = () => {
  if (!fs.existsSync(BACKEND_PERMISSIONS_FILE)) return null;
  const source = fs.readFileSync(BACKEND_PERMISSIONS_FILE, 'utf8');

  const codeBlock = sliceBetween(
    source,
    'export const ADMIN_PERMISSIONS = {',
    '} as const;',
  );
  const codes = new Map<string, string>();
  for (const match of codeBlock.matchAll(/([A-Z0-9_]+):\s*'([^']+)'/g)) {
    codes.set(match[1], match[2]);
  }

  const superAdminBlock = sliceBetween(
    source,
    'SUPERADMIN_ONLY_PERMISSIONS: AdminPermissionCode[] = [',
    '];',
  );
  const superAdminKeys = new Set(
    Array.from(
      superAdminBlock.matchAll(/ADMIN_PERMISSIONS\.([A-Z0-9_]+)/g),
      (match) => match[1],
    ),
  );

  return { codes, superAdminKeys };
};

const backend = readBackendPermissions();

describe('admin permission catalogue', () => {
  it('is internally consistent', () => {
    const codes = ADMIN_PERMISSION_CATALOGUE.map((entry) => entry.code);
    const keys = ADMIN_PERMISSION_CATALOGUE.map((entry) => entry.key);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of ADMIN_PERMISSION_CATALOGUE) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      // A label that is just the code back again defeats the point of the file.
      expect(entry.label).not.toBe(entry.code);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('names an unknown code instead of rendering nothing', () => {
    const described = describeAdminPermission('future.capability');
    expect(described.label).toBe('Future capability');
    expect(described.group).toBe('Other');
  });

  if (!backend) {
    it.skip('matches the backend catalogue (sibling bthreadly not checked out)', () => {});
  } else {
    it('carries every code the backend defines, and no invented ones', () => {
      const backendCodes = Array.from(backend.codes.values()).sort();
      expect([...ALL_ADMIN_PERMISSION_CODES].sort()).toEqual(backendCodes);
    });

    it('maps each key to the same code the backend uses', () => {
      for (const entry of ADMIN_PERMISSION_CATALOGUE) {
        expect(backend.codes.get(entry.key)).toBe(entry.code);
      }
    });

    it('flags exactly the codes the backend refuses to grant to an Admin', () => {
      const backendSuperAdminCodes = Array.from(backend.superAdminKeys)
        .map((key) => backend.codes.get(key))
        .filter((code): code is string => Boolean(code))
        .sort();

      expect(
        ALL_ADMIN_PERMISSION_CODES.filter(isSuperAdminOnlyPermission).sort(),
      ).toEqual(backendSuperAdminCodes);
    });
  }
});

describe('canAccessAdminPath', () => {
  const admin = (...granted: string[]) => ({
    isSuperAdmin: false,
    hasPermission: (code: string) => granted.includes(code),
  });
  const superAdmin = { isSuperAdmin: true, hasPermission: () => true };

  it('lets any admin onto the dashboard', () => {
    expect(canAccessAdminPath('/admin', admin())).toBe(true);
  });

  it('gates a console behind its permission', () => {
    expect(canAccessAdminPath('/admin/audit', admin())).toBe(false);
    expect(canAccessAdminPath('/admin/audit', admin('AUDIT_READ'))).toBe(true);
  });

  it('accepts any one of an either/or set', () => {
    expect(canAccessAdminPath('/admin/users', admin('BRANDS_VERIFY'))).toBe(true);
  });

  /*
    The redirects are the trap: `/admin/brands` renders nothing itself, it
    forwards to `/admin/users?tab=brands`. If it carried no requirement the
    dashboard would offer the link to an admin the destination then bounces.
  */
  it('holds redirect paths to their destination requirement', () => {
    expect(canAccessAdminPath('/admin/brands', admin())).toBe(false);
    expect(canAccessAdminPath('/admin/brands', admin('BRANDS_READ'))).toBe(true);
  });

  it('resolves query strings and child paths to the parent rule', () => {
    expect(
      canAccessAdminPath('/admin/content?tab=products', admin('PRODUCTS_READ')),
    ).toBe(true);
    expect(canAccessAdminPath('/admin/orders/abc-123', admin())).toBe(false);
    expect(
      canAccessAdminPath('/admin/orders/abc-123', admin('PAYOUTS_READ')),
    ).toBe(true);
  });

  /*
    `/admin/custom-orders` must not be matched by the `/admin/orders` rule and
    must not match it either — they are different consoles behind different
    permissions, and prefix matching is exactly where that goes wrong.
  */
  it('keeps custom orders separate from orders', () => {
    expect(canAccessAdminPath('/admin/custom-orders', admin('PAYOUTS_READ'))).toBe(
      false,
    );
    expect(
      canAccessAdminPath('/admin/custom-orders', admin('MODERATION_READ')),
    ).toBe(true);
  });

  it('keeps SuperAdmin-only routes shut to a permissioned admin', () => {
    expect(
      canAccessAdminPath('/admin/settings', admin('SYSTEM_SLA_READ')),
    ).toBe(false);
    expect(canAccessAdminPath('/admin/settings', superAdmin)).toBe(true);
  });

  it('opens everything else to a SuperAdmin', () => {
    expect(canAccessAdminPath('/admin/audit', superAdmin)).toBe(true);
  });
});
