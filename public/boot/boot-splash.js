/*
 * Boot splash controller. MUST stay an external classic script: the
 * production CSP is script-src 'self' (no 'unsafe-inline'), so inline
 * scripts in index.html are BLOCKED on weaz.me. When this logic was inline,
 * mobile/iPad users hit a frozen splash with NO recovery because the
 * timeout + cache-bust code never executed.
 *
 * Responsibilities:
 * - Advance the seal-shaped filler gauge (VLoader curve: 8 → 92, then hold).
 * - Jump the gauge to 100% the instant the app mounts (wiez:boot-ready).
 * - After 15s with no mount: ONE automatic cache-busting reload (stale
 *   index.html self-heal — mobile users cannot clear caches themselves),
 *   then a manual "Tap to reload" fallback if still stuck.
 */
(function () {
  var BOOT_VERSION = '2026-07-05-mobile-boot-v3';
  var BOOT_TIMEOUT_MS = 15000;
  var AUTO_RECOVER_KEY = 'wiez:boot-auto-recovered';
  var BOOT_VERSION_KEY = 'wiez:boot-version';
  var progress = 8;
  var recovering = false;
  var booted = false;

  try {
    if (sessionStorage.getItem(BOOT_VERSION_KEY) !== BOOT_VERSION) {
      sessionStorage.setItem(BOOT_VERSION_KEY, BOOT_VERSION);
      sessionStorage.removeItem(AUTO_RECOVER_KEY);
    }
  } catch (_e) {}

  // Defensive purge: if ANY past deploy ever registered a service worker or
  // populated CacheStorage, a mobile browser can keep serving stale files
  // forever (mobile users cannot clear caches themselves). WIEZ has no
  // service worker today, so unregistering everything is always safe.
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister();
        });
      }).catch(function () {});
    }
  } catch (_e) {}
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) {
          caches.delete(key);
        });
      }).catch(function () {});
    }
  } catch (_e) {}

  function paintProgress() {
    var ring = document.getElementById('boot-splash-ring');
    if (!ring) return false;
    var degrees = progress * 3.6;
    ring.style.background =
      'conic-gradient(from -38deg, rgba(147,51,234,0.96) 0deg ' +
      degrees +
      'deg, rgba(216,180,254,0.28) ' +
      degrees +
      'deg ' +
      Math.min(360, degrees + 18) +
      'deg, rgba(147,51,234,0.08) 0deg)';
    return true;
  }

  var progressTimer = window.setInterval(function () {
    if (!document.getElementById('boot-splash-ring')) {
      window.clearInterval(progressTimer);
      return;
    }
    if (progress >= 92) return; // hold near-full until the app actually mounts
    progress = Math.min(92, progress + (progress < 35 ? 4 : progress < 70 ? 2 : 1));
    paintProgress();
  }, 320);

  function hasAutoRecovered() {
    try {
      return sessionStorage.getItem(AUTO_RECOVER_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  // Force a fresh document fetch. A plain reload can re-serve the same stale
  // cached index.html (pointing at deleted asset hashes); a unique query
  // param guarantees a cache miss on the navigation.
  function cacheBustReload() {
    if (recovering) return;
    recovering = true;
    try {
      sessionStorage.setItem(AUTO_RECOVER_KEY, '1');
    } catch (_e) {}
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('_r', String(Date.now()));
      window.location.replace(url.toString());
    } catch (_e) {
      window.location.reload();
    }
  }

  function showManualReload(message) {
    var splash = document.getElementById('boot-splash');
    if (!splash || !document.body.contains(splash)) return;
    window.clearInterval(progressTimer);

    var gauge = document.getElementById('boot-splash-gauge');
    if (gauge) gauge.style.display = 'none';

    var frame = document.createElement('div');
    frame.style.cssText = 'text-align:center;padding:0 1.5rem;';

    var note = document.createElement('p');
    note.style.cssText = 'margin:0 0 12px;font-size:14px;font-weight:600;';
    note.textContent = message || 'Still loading…';

    var retry = document.createElement('button');
    retry.type = 'button';
    retry.style.cssText =
      'border:0;border-radius:9999px;padding:10px 18px;background:#7c3aed;color:#fff;font-weight:600;font-size:14px;';
    retry.textContent = 'Tap to reload';
    retry.addEventListener('click', cacheBustReload);

    frame.append(note, retry);
    splash.append(frame);
  }

  function recoverOrShow(message) {
    // Once the app has mounted, boot recovery must stand down — runtime
    // stale-chunk handling belongs to the in-app handlers (main.tsx), and a
    // boot-script reload mid-session would throw the user out of their flow.
    if (booted) return;
    if (!hasAutoRecovered()) {
      cacheBustReload();
      return;
    }
    showManualReload(message);
  }

  function isAppAssetUrl(value) {
    if (!value || typeof value !== 'string') return false;
    return (
      value.indexOf('/assets/') !== -1 ||
      value.indexOf('/src/main.') !== -1 ||
      value.indexOf('/src/main.tsx') !== -1
    );
  }

  function isStaleChunkMessage(value) {
    var message = '';
    try {
      message =
        typeof value === 'string'
          ? value
          : value && value.message
            ? String(value.message)
            : String(value || '');
    } catch (_e) {}
    return (
      message.indexOf('Failed to fetch dynamically imported module') !== -1 ||
      message.indexOf('Importing a module script failed') !== -1 ||
      message.indexOf('error loading dynamically imported module') !== -1 ||
      message.indexOf('Loading chunk') !== -1 ||
      message.indexOf('ChunkLoadError') !== -1
    );
  }

  document.addEventListener(
    'error',
    function (event) {
      var target = event.target;
      var url = target && (target.src || target.href);
      if (!isAppAssetUrl(url)) return;
      recoverOrShow('Update needed. Tap to reload.');
    },
    true,
  );

  window.addEventListener('unhandledrejection', function (event) {
    if (isStaleChunkMessage(event.reason)) {
      recoverOrShow('Update needed. Tap to reload.');
    }
  });

  var timer = window.setTimeout(function () {
    var splash = document.getElementById('boot-splash');
    if (!splash || !document.body.contains(splash)) return;
    // First stall this session: try one automatic cache-busting reload.
    // Already tried and still stuck → surface the manual control.
    recoverOrShow('Still loading…');
  }, BOOT_TIMEOUT_MS);

  window.addEventListener(
    'wiez:boot-ready',
    function () {
      booted = true;
      window.clearTimeout(timer);
      window.clearInterval(progressTimer);
      // Visual completion: fill the gauge fully as the app takes over.
      progress = 100;
      paintProgress();
      // Booted cleanly — re-arm auto-recovery for a future stale deploy.
      try {
        sessionStorage.removeItem(AUTO_RECOVER_KEY);
      } catch (_e) {}
    },
    { once: true },
  );
})();
