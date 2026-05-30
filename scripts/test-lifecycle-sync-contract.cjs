const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label} must include ${JSON.stringify(expected)}`);
}

function assertMatches(source, pattern, label) {
  assert(pattern.test(source), `${label} must match ${pattern}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label} must not include ${JSON.stringify(forbidden)}`);
}

const queryKeys = read('src/query/queryKeys.ts');
assertIncludes(queryKeys, "cart: (userId?: string | null)", 'cart query key');
assertIncludes(queryKeys, "['store', 'cart', normalizeId(userId)]", 'cart query key');
assertIncludes(queryKeys, 'wishlistRoot: (userId?: string | null)', 'wishlist query root');
assertIncludes(queryKeys, "['store', 'wishlist', normalizeId(userId)]", 'wishlist query root');
assertIncludes(queryKeys, "['store', 'bagCount', normalizeId(userId)]", 'bag count query key');

const queryPersistor = read('src/query/queryKeys.ts');
assertNotIncludes(queryPersistor, "scope === 'cart'", 'persistable query keys');
assertNotIncludes(queryPersistor, "scope === 'wishlist'", 'persistable query keys');
assertNotIncludes(queryPersistor, "scope === 'bagCount'", 'persistable query keys');

const cartSlice = read('src/features/cartSlice.ts');
assertIncludes(cartSlice, 'const selectLifecycleUserId', 'cart slice user scope');
assertMatches(cartSlice, /queryKeys\.store\.cart\(userId\)/g, 'cart slice user-scoped cart cache');
assertMatches(cartSlice, /queryKeys\.store\.bagCount\(userId\)/g, 'cart slice user-scoped bag count cache');
assertIncludes(cartSlice, "apiClient.get('/store/cart')", 'cart read endpoint');
assertIncludes(cartSlice, "apiClient.post('/store/cart'", 'cart add endpoint');
assertIncludes(cartSlice, 'apiClient.patch(`/store/cart/${payload.itemId}`', 'cart update endpoint');
assertIncludes(cartSlice, 'apiClient.delete(`/store/cart/${itemId}`', 'cart remove endpoint');
assertIncludes(cartSlice, "apiClient.delete('/store/cart')", 'cart clear endpoint');

const wishlistSlice = read('src/features/wishlistSlice.ts');
assertIncludes(wishlistSlice, 'const selectLifecycleUserId', 'wishlist slice user scope');
assertMatches(wishlistSlice, /queryKeys\.store\.wishlist\(userId,/g, 'wishlist slice user-scoped list cache');
assertMatches(wishlistSlice, /queryKeys\.store\.wishlistRoot\(userId\)/g, 'wishlist slice user-scoped invalidation');
assertIncludes(wishlistSlice, "apiClient.get('/store/wishlist'", 'wishlist read endpoint');
assertIncludes(wishlistSlice, "apiClient.post('/store/wishlist'", 'wishlist save endpoint');
assertIncludes(wishlistSlice, 'apiClient.delete(`/store/wishlist/${productId}`', 'wishlist remove endpoint');

const bagApi = read('src/api/BagApi.ts');
assertIncludes(bagApi, "apiClient.get('/bag/count')", 'bag count endpoint');
assertIncludes(bagApi, "apiClient.get('/custom-orders/checkout-bag')", 'custom bag read endpoint');
assertIncludes(bagApi, "apiClient.post('/store/cart'", 'standard bag endpoint');
assertIncludes(bagApi, 'apiClient.get(`/bag/sources/${sourceType}/${sourceId}/status`)', 'bag readiness endpoint');

const storeApi = read('src/api/StoreApi.ts');
assertIncludes(storeApi, 'apiClient.get(`/store/orders?', 'order list endpoint');
assertIncludes(storeApi, 'apiClient.get(`/store/orders/${orderId}`', 'order detail endpoint');
assertIncludes(storeApi, 'apiClient.get(`/store/orders/${orderId}/resolve`', 'order access endpoint');

const sessionCleanup = read('src/auth/sessionCleanup.ts');
assertIncludes(sessionCleanup, "'store'", 'private lifecycle query root');
assertIncludes(sessionCleanup, "'saved'", 'private saved query root');
assertIncludes(sessionCleanup, "'sizeFit'", 'private measurement query root');
assertIncludes(sessionCleanup, "'customOrders'", 'private custom order query root');
assertIncludes(sessionCleanup, 'threadly.pendingBagAction.v1', 'pending bag cleanup');
assertIncludes(sessionCleanup, 'threadly.unifiedCheckout.queue.v1', 'checkout queue cleanup');
assertIncludes(sessionCleanup, 'purgeWebPersistedQueryCache()', 'persisted query cleanup');

const authContext = read('src/context/AuthContext.tsx');
assertMatches(authContext, /await clearPrivateSession\(\);\s*const response = await apiClient\.post\('\/auth\/login'/, 'login user-switch cleanup');

console.log('Web lifecycle sync contract checks passed.');
