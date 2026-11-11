/**
 * Writes /.well-known/assetlinks.json into the build so Android opens emailed
 * WIEZ links in the installed app (App Links), permits Android Credential
 * Manager to use WIEZ passkeys, and leaves links in the browser when the app
 * is not installed. The app claims the paths; this file is the site's half of
 * the handshake, naming which signed app may open them.
 *
 *   ANDROID_APP_LINK_CERT_SHA256  SHA-256 fingerprints (AA:BB:…, comma or
 *                                 space separated) of every key that signs an
 *                                 APK people install: the release/EAS key and,
 *                                 once on Google Play, the Play app-signing key.
 *   ANDROID_APP_LINK_PACKAGE      Defaults to com.wiez.wiez.
 *
 * The versioned public association names the verified release/EAS signer.
 * An explicit build variable can supply a reviewed rotation/Play signer list.
 *
 * The React Native template's debug key is refused. It ships with every new
 * project, so anyone can sign an app with it; naming it here would let any
 * sideloaded app called com.wiez.wiez receive these links, password-reset
 * links included.
 */
const fs = require('node:fs');
const path = require('node:path');

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const PUBLIC_DEBUG_KEY =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

function parseFingerprints(raw) {
  return String(raw ?? '')
    .split(/[\s,]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function buildAssetLinks(env = process.env) {
  const fingerprints = [...new Set(parseFingerprints(env.ANDROID_APP_LINK_CERT_SHA256))];
  if (fingerprints.length === 0) return null;

  const malformed = fingerprints.filter((value) => !FINGERPRINT.test(value));
  if (malformed.length > 0) {
    throw new Error(
      `ANDROID_APP_LINK_CERT_SHA256 must hold colon-separated SHA-256 fingerprints; rejected: ${malformed.join(', ')}`,
    );
  }
  if (fingerprints.includes(PUBLIC_DEBUG_KEY)) {
    throw new Error(
      'ANDROID_APP_LINK_CERT_SHA256 names the public React Native debug key. Use the release/EAS key and the Play app-signing key.',
    );
  }

  const packageName = String(env.ANDROID_APP_LINK_PACKAGE ?? '').trim() || 'com.wiez.wiez';
  if (!PACKAGE_NAME.test(packageName)) {
    throw new Error(`ANDROID_APP_LINK_PACKAGE is not an Android package name: ${packageName}`);
  }

  return [
    {
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

function main() {
  const outDir = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
  let statements = buildAssetLinks();
  if (!statements) {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/.well-known/assetlinks.json'), 'utf8'));
    if (!Array.isArray(source) || source.length !== 1 || source[0]?.target?.namespace !== 'android_app' ||
      source[0]?.target?.package_name !== 'com.wiez.wiez' || !Array.isArray(source[0]?.target?.sha256_cert_fingerprints))
      throw new Error('Invalid versioned Android release association.');
    statements = buildAssetLinks({
      ANDROID_APP_LINK_PACKAGE: source[0].target.package_name,
      ANDROID_APP_LINK_CERT_SHA256: source[0].target.sha256_cert_fingerprints.join(','),
    });
    if (!statements || JSON.stringify(statements) !== JSON.stringify(source))
      throw new Error('The versioned Android association must use the validated release contract.');
  }
  const target = path.join(outDir, '.well-known', 'assetlinks.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(statements, null, 2)}\n`);
  const { package_name: packageName, sha256_cert_fingerprints: keys } = statements[0].target;
  console.log(`[app-links] wrote ${path.relative(process.cwd(), target)} for ${packageName} (${keys.length} key${keys.length === 1 ? '' : 's'})`);
}

module.exports = { buildAssetLinks, parseFingerprints, PUBLIC_DEBUG_KEY };

if (require.main === module) {
  main();
}
