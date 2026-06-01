const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = read('src/App.tsx');
const sidebar = read('src/components/admin/AdminSidebar.tsx');
const permissionsHook = read('src/hooks/useAdminPermissions.ts');
const usersPage = read('src/pages/admin/AdminUsersPage.tsx');
const userManageModal = read('src/pages/admin/modals/UserManageModal.tsx');
const productsPage = read('src/pages/admin/AdminProductsPage.tsx');

const failures = [];
const assertContains = (label, source, expected) => {
  if (!source.includes(expected)) {
    failures.push(`${label}: missing ${expected}`);
  }
};
const assertNotContains = (label, source, unexpected) => {
  if (source.includes(unexpected)) {
    failures.push(`${label}: unexpected ${unexpected}`);
  }
};

[
  'USERS_ROLE_ASSIGN_ADMIN',
  'USERS_ROLE_ASSIGN_USER',
  'USERS_DATA_EXPORT',
  'USERS_DATA_WIPE',
  'SYSTEM_FEATURE_FLAGS_WRITE',
  'SYSTEM_SETTINGS_WRITE',
  'ADMIN_EMAIL_CHANGE',
  'PERMISSIONS_MANAGE',
  'CONTENT_REVIEW_READ',
  'CONTENT_REVIEW_MANAGE',
  'ALERTS_READ',
  'ALERTS_MANAGE',
].forEach((code) => {
  assertContains('permission alias map', permissionsHook, code);
});

assertContains(
  'admin content route',
  app,
  "permission={['PRODUCTS_READ', 'COLLECTIONS_READ']}",
);
assertContains(
  'admin content review route',
  app,
  'permission="CONTENT_REVIEW_READ"><AdminContentReviewPage',
);
assertContains('admin settings route', app, '<RequireAdminPermission superAdminOnly');
assertContains(
  'admin monitoring route',
  app,
  'permission="ALERTS_READ"><AdminMonitoringPage',
);
assertContains(
  'admin sidebar content guard',
  sidebar,
  "permissions: ['PRODUCTS_READ', 'COLLECTIONS_READ']",
);
assertContains(
  'admin sidebar content review guard',
  sidebar,
  "permission: 'CONTENT_REVIEW_READ'",
);
assertContains(
  'admin sidebar monitoring guard',
  sidebar,
  "permission: 'ALERTS_READ'",
);

assertContains('create admin action', usersPage, 'canCreateAdmin');
assertContains('create admin action', usersPage, "hasPermission('USERS_ROLE_ASSIGN_ADMIN')");

[
  'canChangeRoles',
  'canUpdateSensitiveUserAccess',
  'canManagePermissions',
  'canWipeUserData',
].forEach((gate) => {
  assertContains('user manage modal', userManageModal, gate);
});
[
  "hasPermission('USERS_ROLE_ASSIGN_ADMIN')",
  "hasPermission('USERS_ROLE_ASSIGN_USER')",
  "hasPermission('USERS_UPDATE')",
  "hasPermission('PERMISSIONS_MANAGE')",
  "hasPermission('USERS_DATA_WIPE')",
].forEach((check) => {
  assertContains('user manage modal', userManageModal, check);
});
assertNotContains(
  'user manage modal',
  userManageModal,
  "isSuperAdmin && user.role === 'Admin' && !isDeleted && (",
);

assertContains('featured history gate', productsPage, 'canViewFeaturedHistory');
assertContains('featured history gate', productsPage, 'isSuperAdmin && canFeatured');

if (failures.length > 0) {
  console.error('Admin permission contract check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Admin permission contract check passed.');
