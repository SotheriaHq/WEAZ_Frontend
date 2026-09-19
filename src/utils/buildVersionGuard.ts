import { toast } from 'sonner';

/**
 * Live stale-build detection (industry-standard SPA pattern): the build emits
 * /version.json with a unique buildId (vite.config.ts) and stamps the same id
 * into the bundle. Long-lived tabs check the manifest when they wake up
 * (visibility/focus) and on an interval; when a newer deploy is detected the
 * app refreshes itself on the NEXT route navigation — before the user ever
 * hits a dead lazy chunk.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_CHECK_GAP_MS = 60 * 1000;

let staleDetected = false;
let lastCheckAt = 0;
let notified = false;

export const isNewBuildAvailable = (): boolean => staleDetected;

async function checkBuildVersion(): Promise<void> {
  if (staleDetected) return;
  const now = Date.now();
  if (now - lastCheckAt < MIN_CHECK_GAP_MS) return;
  lastCheckAt = now;
  try {
    const response = await fetch(`/version.json?ts=${now}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { buildId?: string };
    if (payload?.buildId && payload.buildId !== __WIEZ_BUILD_ID__) {
      staleDetected = true;
      if (!notified) {
        notified = true;
        toast.info('A new version is ready — it loads on your next screen.', {
          duration: 6000,
        });
      }
    }
  } catch {
    // Offline or transient network failure — try again on the next trigger.
  }
}

export function initBuildVersionGuard(): void {
  if (import.meta.env.DEV) return; // dev server has no version.json
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkBuildVersion();
  });
  window.addEventListener('focus', () => {
    void checkBuildVersion();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkBuildVersion();
  }, CHECK_INTERVAL_MS);
}
