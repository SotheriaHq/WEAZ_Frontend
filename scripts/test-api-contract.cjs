const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

function assertIncludes(source, expected, label) {
  assert(
    source.includes(expected),
    `${label} must include ${JSON.stringify(expected)}`,
  );
}

function assertNotIncludes(source, forbidden, label) {
  assert(
    !source.includes(forbidden),
    `${label} must not include stale endpoint ${JSON.stringify(forbidden)}`,
  );
}

const srcFiles = [];
function collectSourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      srcFiles.push(fullPath);
    }
  }
}
collectSourceFiles(path.join(repoRoot, 'src'));

const combinedSource = srcFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assertNotIncludes(
  combinedSource,
  '/auth/update-profile/',
  'web source',
);
assertNotIncludes(
  combinedSource,
  '/order/my-orders',
  'web source',
);
assertNotIncludes(combinedSource, "apiClient.post('/payments", 'web source');
assertNotIncludes(combinedSource, 'apiClient.post("/payments', 'web source');

const profilePage = read('src/pages/profile/EndUserProfile.tsx');
assertIncludes(profilePage, "apiClient.patch('/users/me/profile'", 'own profile edit');

const storeApi = read('src/api/StoreApi.ts');
assertIncludes(storeApi, '/store/orders', 'buyer orders API');

const publicLinks = read('src/api/PublicLinkApi.ts');
assertIncludes(
  publicLinks,
  '/users/lookup/username/',
  'public profile username lookup',
);
assertIncludes(publicLinks, '/public/storefronts/', 'public storefront lookup');

const paymentApi = read('src/api/PaymentApi.ts');
assertIncludes(paymentApi, "'/payment/initialize-unified'", 'payment initialize');
assertIncludes(paymentApi, "'/payment/verify'", 'payment verify');

const adminApi = read('src/api/AdminApi.ts');
assertIncludes(adminApi, "'/admin/alerts'", 'admin alert list');
assertIncludes(adminApi, "'/admin/alerts/summary'", 'admin alert summary');
assertIncludes(adminApi, '/acknowledge', 'admin alert acknowledge');
assertIncludes(adminApi, '/resolve', 'admin alert resolve');
assertIncludes(adminApi, '/ignore', 'admin alert ignore');
assertIncludes(adminApi, "'/admin/content-review/submissions'", 'admin content review queue');
assertIncludes(adminApi, '/admin/content-review/submissions/${id}/approve', 'admin content approve');
assertIncludes(adminApi, '/admin/content-review/submissions/${id}/reject', 'admin content reject');
assertIncludes(adminApi, '/admin/content-review/submissions/${id}/request-changes', 'admin content request changes');
assertIncludes(adminApi, "'/admin/content-review/reports'", 'admin content reports');
assertIncludes(adminApi, '/content-integrity/reports', 'content report endpoint');
assertIncludes(adminApi, '/content-integrity/submissions/${id}', 'owner content review reason endpoint');

const marketApi = read('src/api/MarketApi.ts');
assertIncludes(marketApi, "'/market/signals/batch'", 'market signal batch');

const messagingApi = read('src/api/MessagingApi.ts');
assertIncludes(messagingApi, "'/messaging/inbox'", 'messaging inbox');
assertIncludes(messagingApi, '/messaging/threads/', 'messaging thread routes');

const notificationsApi = read('src/api/NotificationsApi.ts');
assertIncludes(notificationsApi, "'/notifications/unread-count'", 'notification unread count');
assertIncludes(notificationsApi, '/notifications?', 'notification list');

const storeCollectionsApi = read('src/api/storeCollections.ts');
assertIncludes(storeCollectionsApi, "'/store-collections/initialize'", 'store collection initialize');
assertIncludes(storeCollectionsApi, '/store-collections/', 'store collection item routes');

console.log('Web API contract parity checks passed.');
