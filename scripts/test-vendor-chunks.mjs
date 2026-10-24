import assert from 'node:assert/strict';
import { loadConfigFromFile } from 'vite';

const result = await loadConfigFromFile({ command: 'build', mode: 'production' });
const output = result?.config.build?.rollupOptions?.output;
assert.ok(output && !Array.isArray(output) && typeof output.manualChunks === 'function');
const classify = output.manualChunks;
for (const name of ['react', 'react-dom', 'scheduler']) {
  assert.equal(classify(`/checkout/node_modules/${name}/cjs/index.js`, {}), 'react-vendor');
}
assert.equal(classify('/checkout/node_modules/@sentry/react/build/esm/index.js', {}), undefined);
assert.equal(classify('/checkout/node_modules/@sentry/core/build/esm/index.js', {}), undefined);
assert.equal(classify('/checkout/node_modules/react-router/dist/index.js', {}), 'router-vendor');
console.log('Vendor chunk package-boundary checks passed.');
