// assetlinks.json names only real signing keys, is written into the build
// output under /.well-known, and is absent when no key is configured.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildAssetLinks, PUBLIC_DEBUG_KEY } = require('./generate-app-links.cjs');

const release = Array.from({ length: 32 }, (_, i) => (i * 7 + 16).toString(16).padStart(2, '0').toUpperCase()).join(':');
const play = Array.from({ length: 32 }, (_, i) => (255 - i).toString(16).padStart(2, '0').toUpperCase()).join(':');

// Not configured: nothing is published, links stay in the browser.
assert.equal(buildAssetLinks({}), null);
assert.equal(buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: '  ' }), null);

// Two keys, mixed separators and case, duplicates collapsed.
const statements = buildAssetLinks({
  ANDROID_APP_LINK_CERT_SHA256: `${release.toLowerCase()}, ${play}\n${release}`,
});
assert.deepEqual(statements, [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.wiez.wiez',
      sha256_cert_fingerprints: [release, play],
    },
  },
]);

// Refusals.
assert.throws(() => buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: PUBLIC_DEBUG_KEY }), /public React Native debug key/);
assert.throws(() => buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: `${release}, ${PUBLIC_DEBUG_KEY.toLowerCase()}` }), /debug key/);
assert.throws(() => buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: 'AB:CD' }), /colon-separated SHA-256/);
assert.throws(() => buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: release.replace(/:/g, '') }), /colon-separated SHA-256/);
assert.throws(
  () => buildAssetLinks({ ANDROID_APP_LINK_CERT_SHA256: release, ANDROID_APP_LINK_PACKAGE: 'not a package' }),
  /package name/,
);

// The CLI writes dist/.well-known/assetlinks.json, and writes nothing unset.
const script = path.join(__dirname, 'generate-app-links.cjs');
const run = (env, dir) =>
  execFileSync(process.execPath, [script, dir], { env: { ...process.env, ANDROID_APP_LINK_CERT_SHA256: '', ...env } });

const withKey = fs.mkdtempSync(path.join(os.tmpdir(), 'app-links-'));
run({ ANDROID_APP_LINK_CERT_SHA256: release }, withKey);
const written = JSON.parse(fs.readFileSync(path.join(withKey, '.well-known', 'assetlinks.json'), 'utf8'));
assert.deepEqual(written[0].target.sha256_cert_fingerprints, [release]);

const withoutKey = fs.mkdtempSync(path.join(os.tmpdir(), 'app-links-'));
run({}, withoutKey);
assert.equal(fs.existsSync(path.join(withoutKey, '.well-known')), false);

// The production build runs it after Vite has emptied dist.
const pkg = require('../package.json');
assert.match(pkg.scripts.build, /vite build.*&& node scripts\/generate-app-links\.cjs/);

console.log('app links contract: all checks passed');
