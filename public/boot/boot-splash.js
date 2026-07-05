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
 * - After 25s with no mount: ONE automatic cache-busting reload (stale
 *   index.html self-heal — mobile users cannot clear caches themselves),
 *   then a manual "Tap to reload" fallback if still stuck.
 */
(function () {
  var BOOT_TIMEOUT_MS = 15000;
  var AUTO_RECOVER_KEY = 'wiez:boot-auto-recovered';
  var progress = 8;

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
    ring.style.background =
      'conic-gradient(rgba(147,51,234,0.95) ' +
      progress * 3.6 +
      'deg, rgba(147,51,234,0.12) 0deg)';
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

  function showManualReload() {
    var splash = document.getElementById('boot-splash');
    if (!splash || !document.body.contains(splash)) return;
    window.clearInterval(progressTimer);

    var gauge = document.getElementById('boot-splash-gauge');
    if (gauge) gauge.style.display = 'none';

    var frame = document.createElement('div');
    frame.style.cssText = 'text-align:center;padding:0 1.5rem;';

    var note = document.createElement('p');
    note.style.cssText = 'margin:0 0 12px;font-size:14px;font-weight:600;';
    note.textContent = 'Still loading…';

    var retry = document.createElement('button');
    retry.type = 'button';
    retry.style.cssText =
      'border:0;border-radius:9999px;padding:10px 18px;background:#7c3aed;color:#fff;font-weight:600;font-size:14px;';
    retry.textContent = 'Tap to reload';
    retry.addEventListener('click', cacheBustReload);

    frame.append(note, retry);
    splash.append(frame);
  }

  var timer = window.setTimeout(function () {
    var splash = document.getElementById('boot-splash');
    if (!splash || !document.body.contains(splash)) return;
    // First stall this session: try one automatic cache-busting reload.
    // Already tried and still stuck → surface the manual control.
    if (!hasAutoRecovered()) {
      cacheBustReload();
      return;
    }
    showManualReload();
  }, BOOT_TIMEOUT_MS);

  window.addEventListener(
    'wiez:boot-ready',
    function () {
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
