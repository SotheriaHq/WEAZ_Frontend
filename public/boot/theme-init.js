/*
 * Pre-paint theme bootstrap. MUST stay an external classic script:
 * the production CSP is script-src 'self' (no 'unsafe-inline'), so inline
 * <script> blocks in index.html are BLOCKED on weaz.me — this file is the
 * CSP-safe home for logic that must run before first paint.
 */
(function () {
  var storageKey = 'vite-ui-theme';
  var embeddedSurfaceKey = 'WIEZ.studio.embeddedSurface';
  var embeddedThemeKey = 'WIEZ.studio.embeddedTheme';
  var fallbackTheme = 'system';
  var root = document.documentElement;
  var storedTheme = null;
  var params = new URLSearchParams(window.location.search);
  var explicitEmbeddedSurface = params.get('surface') === 'mobile-app';
  var sessionEmbeddedSurface = false;
  var embeddedTheme = null;

  try {
    storedTheme = localStorage.getItem(storageKey);
  } catch (_error) {
    storedTheme = null;
  }

  try {
    sessionEmbeddedSurface =
      sessionStorage.getItem('WIEZ.studio.embeddedSurface') === 'mobile-app' ||
      sessionStorage.getItem('wiez.studio.embeddedSurface') === 'mobile-app';
  } catch (_error) {
    sessionEmbeddedSurface = false;
  }

  if (explicitEmbeddedSurface || sessionEmbeddedSurface) {
    var requestedTheme = params.get('theme');
    if (requestedTheme === 'light' || requestedTheme === 'dark') {
      embeddedTheme = requestedTheme;
      try {
        sessionStorage.setItem('WIEZ.studio.embeddedSurface', 'mobile-app');
        sessionStorage.setItem('wiez.studio.embeddedSurface', 'mobile-app');
        sessionStorage.setItem('WIEZ.studio.embeddedTheme', requestedTheme);
        sessionStorage.setItem('wiez.studio.embeddedTheme', requestedTheme);
      } catch (_error) {}
    } else {
      try {
        var savedEmbeddedTheme =
          sessionStorage.getItem('WIEZ.studio.embeddedTheme') ||
          sessionStorage.getItem('wiez.studio.embeddedTheme');
        embeddedTheme =
          savedEmbeddedTheme === 'light' || savedEmbeddedTheme === 'dark'
            ? savedEmbeddedTheme
            : null;
      } catch (_error) {
        embeddedTheme = null;
      }
    }
  }

  var theme =
    embeddedTheme ||
    (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
      ? storedTheme
      : fallbackTheme);

  var prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var className = theme === 'dark' || (theme === 'system' && prefersDark)
    ? 'dark'
    : 'light';

  root.classList.remove('light', 'dark');
  root.classList.add(className);
  root.dataset.theme = className;
  root.dataset.themePreference = theme;
  root.style.colorScheme = className;

  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', className === 'dark' ? '#0a0a0a' : '#ffffff');
  }
})();
