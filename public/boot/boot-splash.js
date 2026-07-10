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
  var BOOT_VERSION = '2026-07-10-mobile-boot-v4';
  var BOOT_TIMEOUT_MS = 15000;
  var AUTO_RECOVER_KEY = 'wiez:boot-auto-recovered';
  var BOOT_VERSION_KEY = 'wiez:boot-version';
  var MAX_AUTO_RECOVER = 3;
  var RETRY_DELAY_MS = 5000;
  var progress = 8;
  var recovering = false;
  var booted = false;
  var retryCountdownTimer = null;

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

  function autoRecoverCount() {
    try {
      var parsed = parseInt(sessionStorage.getItem(AUTO_RECOVER_KEY) || '0', 10);
      return isNaN(parsed) ? 0 : parsed;
    } catch (_e) {
      // Storage unavailable: never risk an infinite reload loop.
      return MAX_AUTO_RECOVER;
    }
  }

  // Force a fresh document fetch. A plain reload can re-serve the same stale
  // cached index.html (pointing at deleted asset hashes); a unique query
  // param guarantees a cache miss on the navigation.
  function cacheBustReload() {
    if (recovering) return;
    recovering = true;
    try {
      sessionStorage.setItem(AUTO_RECOVER_KEY, String(autoRecoverCount() + 1));
    } catch (_e) {}
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('_r', String(Date.now()));
      window.location.replace(url.toString());
    } catch (_e) {
      window.location.reload();
    }
  }

  // Single fallback frame — repeated failure signals (asset error + timeout)
  // must UPDATE the message, not stack duplicate prompts.
  function ensureFallbackNote(message) {
    var splash = document.getElementById('boot-splash');
    if (!splash || !document.body.contains(splash)) return null;
    window.clearInterval(progressTimer);

    var gauge = document.getElementById('boot-splash-gauge');
    if (gauge) gauge.style.display = 'none';

    var note = document.getElementById('boot-splash-note');
    if (!note) {
      var frame = document.createElement('div');
      frame.id = 'boot-splash-fallback';
      frame.style.cssText = 'text-align:center;padding:0 1.5rem;';

      note = document.createElement('p');
      note.id = 'boot-splash-note';
      note.style.cssText = 'margin:0 0 12px;font-size:14px;font-weight:600;';

      var retry = document.createElement('button');
      retry.type = 'button';
      retry.style.cssText =
        'border:0;border-radius:9999px;padding:10px 18px;background:#7c3aed;color:#fff;font-weight:600;font-size:14px;';
      retry.textContent = 'Tap to reload';
      retry.addEventListener('click', cacheBustReload);

      frame.append(note, retry);
      splash.append(frame);
    }
    note.textContent = message || 'Still loading…';
    return note;
  }

  function scheduleAutoRetry(message, attempt) {
    if (retryCountdownTimer) return;
    var seconds = Math.ceil(RETRY_DELAY_MS / 1000);
    var label = function () {
      return (
        message +
        ' Reloading in ' +
        seconds +
        's… (attempt ' +
        attempt +
        ' of ' +
        MAX_AUTO_RECOVER +
        ')'
      );
    };
    if (!ensureFallbackNote(label())) return;
    retryCountdownTimer = window.setInterval(function () {
      if (booted) {
        window.clearInterval(retryCountdownTimer);
        return;
      }
      seconds -= 1;
      if (seconds <= 0) {
        window.clearInterval(retryCountdownTimer);
        cacheBustReload();
        return;
      }
      ensureFallbackNote(label());
    }, 1000);
  }

  function recoverOrShow(message) {
    // Once the app has mounted, boot recovery must stand down — runtime
    // stale-chunk handling belongs to the in-app handlers (main.tsx), and a
    // boot-script reload mid-session would throw the user out of their flow.
    if (booted) return;
    var count = autoRecoverCount();
    if (count === 0) {
      cacheBustReload();
      return;
    }
    if (count < MAX_AUTO_RECOVER) {
      scheduleAutoRetry(message, count + 1);
      return;
    }
    ensureFallbackNote(message + ' Automatic retries failed — tap to try again.');
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
