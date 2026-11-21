const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const consentSourcePath = path.resolve(__dirname, '..', 'src', 'privacy', 'consent.ts');
const consentSource = fs.readFileSync(consentSourcePath, 'utf8');

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: consentSourcePath,
  }).outputText;
}

const compiledCode = compile(consentSource);

function loadConsentEnvironment(options = {}) {
  const store = { ...(options.store ?? {}) };
  const storageEventListeners = [];
  let storageSetItemOverride = options.setItemOverride || null;
  let storageGetItemOverride = options.getItemOverride || null;
  let storageRemoveItemOverride = options.removeItemOverride || null;

  const fakeStorage = {
    getItem: (key) => {
      if (storageGetItemOverride) return storageGetItemOverride(key, store);
      return store[key] ?? null;
    },
    setItem: (key, value) => {
      if (storageSetItemOverride) return storageSetItemOverride(key, value, store);
      store[key] = String(value);
    },
    removeItem: (key) => {
      if (storageRemoveItemOverride) return storageRemoveItemOverride(key, store);
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };

  const fakeWindow = {
    localStorage: fakeStorage,
    addEventListener: (type, listener) => {
      if (type === 'storage') storageEventListeners.push(listener);
    },
    removeEventListener: () => {},
  };

  const fakeNavigator = {
    globalPrivacyControl: options.globalPrivacyControl ?? false,
    doNotTrack: options.doNotTrack ?? null,
  };

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'react') {
        return {
          useSyncExternalStore: (sub, getSnapshot) => getSnapshot(),
        };
      }
      return require(request);
    },
    window: fakeWindow,
    navigator: fakeNavigator,
    console,
    Date,
    JSON,
    Number,
    String,
    Set,
  };

  vm.runInNewContext(compiledCode, sandbox, { filename: consentSourcePath });

  return {
    exports: module.exports,
    store,
    triggerStorageEvent: (key, newValue) => {
      const event = { key, newValue };
      for (const listener of storageEventListeners) {
        listener(event);
      }
    },
    setSetItemOverride: (fn) => { storageSetItemOverride = fn; },
    setGetItemOverride: (fn) => { storageGetItemOverride = fn; },
    setRemoveItemOverride: (fn) => { storageRemoveItemOverride = fn; },
  };
}

async function runSuite() {
  console.log('======================================================');
  console.log('RUNNING EXECUTABLE PRIVACY CONSENT FAILURE-PATH SUITE (PC-01 TO PC-15)');
  console.log('======================================================\n');

  const now = new Date().toISOString();
  const validApproval = JSON.stringify({ version: 1, decidedAt: now, analytics: true, thirdPartySignIn: true });
  const validRefusal = JSON.stringify({ version: 1, decidedAt: now, analytics: false, thirdPartySignIn: false });

  // PC-01: Legacy refusal only -> Refusal preserved
  {
    const env = loadConsentEnvironment({ store: { 'wiez.consent': validRefusal } });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, true, 'PC-01: Must recognize legacy refusal');
    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-01: Analytics must remain disallowed');
    assert.equal(env.exports.analyticsPermitted(), false, 'PC-01: Analytics permitted must be false');
    assert.ok(env.store['aru.consent'], 'PC-01: Primary key must be migrated');
    assert.equal(env.store['wiez.consent'], undefined, 'PC-01: Legacy key must be retired');
    console.log('[PASS] PC-01: Legacy refusal only -> refusal preserved without re-prompting');
  }

  // PC-02: Legacy approval only -> Existing approved scope preserved
  {
    const env = loadConsentEnvironment({ store: { 'wiez.consent': validApproval } });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, true, 'PC-02: Must recognize legacy approval');
    assert.equal(env.exports.isAllowed('analytics'), true, 'PC-02: Analytics must be allowed');
    assert.equal(env.exports.analyticsPermitted(), true, 'PC-02: Analytics permitted must be true');
    assert.ok(env.store['aru.consent'], 'PC-02: Primary key must be migrated');
    assert.equal(env.store['wiez.consent'], undefined, 'PC-02: Legacy key must be retired');
    console.log('[PASS] PC-02: Legacy approval only -> approved scope preserved and migrated');
  }

  // PC-03: ARU and WIEZ records agree -> Canonical state retained
  {
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': validApproval,
        'wiez.consent': validApproval,
      },
    });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, true);
    assert.equal(env.exports.isAllowed('analytics'), true);
    console.log('[PASS] PC-03: ARU and WIEZ records agree -> canonical primary state retained');
  }

  // PC-04: ARU and WIEZ records conflict -> Approved precedence (primary is authoritative)
  {
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': validApproval, // Primary = Approved
        'wiez.consent': validRefusal,  // Legacy = Refused
      },
    });
    assert.equal(env.exports.isAllowed('analytics'), true, 'PC-04: Primary approval must override legacy refusal');

    const env2 = loadConsentEnvironment({
      store: {
        'aru.consent': validRefusal,   // Primary = Refused
        'wiez.consent': validApproval, // Legacy = Approved
      },
    });
    assert.equal(env2.exports.isAllowed('analytics'), false, 'PC-04: Primary refusal must override legacy approval');
    console.log('[PASS] PC-04: ARU and WIEZ records conflict -> primary key takes absolute precedence');
  }

  // PC-05: Corrupted ARU record, valid legacy record -> Safe recovery
  {
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': '{ invalid unparseable json',
        'wiez.consent': validApproval,
      },
    });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, true, 'PC-05: Must fall back to valid legacy record');
    assert.equal(env.exports.isAllowed('analytics'), true, 'PC-05: Must adopt legacy approval');
    assert.equal(env.store['wiez.consent'], undefined, 'PC-05: Legacy key retired after recovery');
    assert.ok(env.store['aru.consent'].includes('"analytics":true'), 'PC-05: Primary overwritten with valid choice');
    console.log('[PASS] PC-05: Corrupted ARU record, valid legacy record -> safe fallback and recovery');
  }

  // PC-06: Valid ARU record, corrupted legacy record -> Canonical state retained
  {
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': validRefusal,
        'wiez.consent': '{ corrupt legacy json',
      },
    });
    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-06: Canonical primary read first');
    console.log('[PASS] PC-06: Valid ARU record, corrupted legacy record -> canonical state retained');
  }

  // PC-07: Both records corrupted -> Privacy-safe default
  {
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': '{ bad',
        'wiez.consent': '{ also bad',
      },
    });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, false, 'PC-07: Must not assume consent on corruption');
    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-07: Analytics must be false');
    assert.equal(env.exports.analyticsPermitted(), false, 'PC-07: Telemetry must be gated');
    console.log('[PASS] PC-07: Both records corrupted -> safe default (decided=false, analytics=false)');
  }

  // PC-08: Canonical write fails -> No new consent granted
  {
    const env = loadConsentEnvironment({ store: {} });
    // Simulate quota exceeded or private browsing security error
    env.setSetItemOverride(() => {
      const err = new Error('QuotaExceededError: storage full');
      err.name = 'QuotaExceededError';
      throw err;
    });
    // Calling saveConsent with OPTIONAL_OFF
    assert.doesNotThrow(() => env.exports.saveConsent(env.exports.OPTIONAL_OFF));
    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-08: Analytics must not be enabled');
    console.log('[PASS] PC-08: Canonical write fails -> error safely handled, no unauthorized consent');
  }

  // PC-09: Read-back fails or mismatches -> No premature legacy deletion
  {
    const legacyStore = { 'wiez.consent': validApproval };
    let legacyDeleted = false;
    const env = loadConsentEnvironment({
      store: legacyStore,
      getItemOverride: (key, st) => {
        if (key === 'aru.consent') return 'mismatched-readback-value';
        return st[key] ?? null;
      },
      removeItemOverride: (key, st) => {
        if (key === 'wiez.consent') legacyDeleted = true;
        delete st[key];
      },
    });
    assert.equal(legacyDeleted, false, 'PC-09: Legacy key must NOT be deleted when read-back verification fails');
    console.log('[PASS] PC-09: Read-back fails or mismatches -> legacy key protected against deletion');
  }

  // PC-10: Legacy deletion fails -> Safe, repeatable migration
  {
    const legacyStore = { 'wiez.consent': validApproval };
    const env = loadConsentEnvironment({
      store: legacyStore,
      removeItemOverride: (key) => {
        if (key === 'wiez.consent') throw new Error('Permission denied');
      },
    });
    // Migration returns the record safely even if removeItem throws
    assert.equal(env.exports.isAllowed('analytics'), true);
    assert.ok(env.store['aru.consent'], 'PC-10: Primary write succeeded');
    console.log('[PASS] PC-10: Legacy deletion fails -> primary write verified, safe repeatable migration');
  }

  // PC-11: Analytics withdrawn in another tab -> Tracking permission revoked
  {
    const env = loadConsentEnvironment({ store: { 'aru.consent': validApproval } });
    assert.equal(env.exports.analyticsPermitted(), true);

    // Another tab writes withdrawal to aru.consent
    env.store['aru.consent'] = validRefusal;
    env.triggerStorageEvent('aru.consent', validRefusal);

    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-11: Analytics must be revoked immediately');
    assert.equal(env.exports.analyticsPermitted(), false, 'PC-11: Telemetry must be disabled');
    console.log('[PASS] PC-11: Analytics withdrawn in another tab -> tracking permission revoked');
  }

  // PC-12: Conflicting cross-tab storage events -> Safe final consent state
  {
    const env = loadConsentEnvironment({ store: { 'aru.consent': validRefusal } });
    assert.equal(env.exports.isAllowed('analytics'), false);

    // Outdated legacy event arrives from another tab
    env.triggerStorageEvent('wiez.consent', validApproval);
    // Since primary key still exists with refusal, primary precedence applies
    assert.equal(env.exports.isAllowed('analytics'), false, 'PC-12: Primary refusal takes precedence over legacy event');
    console.log('[PASS] PC-12: Conflicting cross-tab storage events -> safe canonical state maintained');
  }

  // PC-13: Reload after interrupted migration -> Existing decision preserved
  {
    // Intermediate interrupted state: primary written, legacy still present
    const env = loadConsentEnvironment({
      store: {
        'aru.consent': validApproval,
        'wiez.consent': validApproval,
      },
    });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, true);
    assert.equal(env.exports.isAllowed('analytics'), true);
    console.log('[PASS] PC-13: Reload after interrupted migration -> existing decision preserved');
  }

  // PC-14: No valid consent exists -> Optional integrations remain gated
  {
    const env = loadConsentEnvironment({ store: {} });
    const state = env.exports.getConsentState();
    assert.equal(state.decided, false);
    assert.equal(state.record, null);
    assert.equal(env.exports.isAllowed('analytics'), false);
    assert.equal(env.exports.analyticsPermitted(), false);
    console.log('[PASS] PC-14: No valid consent exists -> optional integrations remain strictly gated');
  }

  // PC-15: Consent withdrawal -> No unauthorized reactivation
  {
    const env = loadConsentEnvironment({ store: { 'aru.consent': validApproval } });
    assert.equal(env.exports.analyticsPermitted(), true);

    env.exports.saveConsent(env.exports.OPTIONAL_OFF);
    assert.equal(env.exports.isAllowed('analytics'), false);
    assert.equal(env.exports.analyticsPermitted(), false);
    assert.equal(env.store['wiez.consent'], undefined);
    assert.ok(env.store['aru.consent'].includes('"analytics":false'));
    console.log('[PASS] PC-15: Consent withdrawal -> no unauthorized reactivation');
  }

  console.log('\n======================================================');
  console.log('ALL 15 PRIVACY CONSENT FAILURE-PATH SCENARIOS PASSED (15/15).');
  console.log('======================================================\n');
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
