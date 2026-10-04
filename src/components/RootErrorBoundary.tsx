import React from 'react';
import { captureClientException } from '../observability/sentry';
import {
  STALE_BUNDLE_SESSION_KEYS,
  recoverFromStaleBundle,
  shouldRecoverFromStaleBundle,
} from '@/utils/staleBundle';

type RootErrorBoundaryProps = {
  children: React.ReactNode;
};

type RootErrorBoundaryState = {
  error: Error | null;
  recovering: boolean;
};

const showBootFailure = (message: string) => {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;

  splash.replaceChildren();
  const frame = document.createElement('div');
  frame.style.cssText =
    'max-width:20rem;text-align:center;padding:0 1rem;font-family:system-ui,sans-serif;';

  const title = document.createElement('p');
  title.style.cssText = 'font-size:0.95rem;font-weight:600;margin:0 0 0.75rem;';
  title.textContent = 'WIEZ could not start';

  const detail = document.createElement('p');
  detail.style.cssText =
    'font-size:0.8rem;line-height:1.45;opacity:0.8;margin:0 0 1rem;';
  detail.textContent = message;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.style.cssText =
    'border:0;border-radius:9999px;padding:0.65rem 1.25rem;background:#7c3aed;color:#fff;font-weight:600;font-size:0.85rem;';
  retry.textContent = 'Reload';
  retry.addEventListener('click', () => {
    window.location.reload();
  });

  frame.append(title, detail, retry);
  splash.append(frame);
};

export const removeBootSplash = () => {
  document.getElementById('boot-splash')?.remove();
  window.dispatchEvent(new Event('wiez:boot-ready'));

  // Strip the one-time cache-busting recovery param (added by index.html when a
  // stale boot is detected) so it doesn't linger in the address bar or in shared
  // links once the app has booted cleanly.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_r')) {
      url.searchParams.delete('_r');
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    // ignore — URL cleanup is best-effort
  }
};

export class RootErrorBoundary extends React.Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { error: null, recovering: false };

  /*
    A half-replaced deploy is recovered, not reported.

    This boundary catches everything that fails OUTSIDE the router — the
    providers, the shell, the first chunk of the app itself — and it used to
    render "WIEZ could not start" with a Reload button for ALL of it. After a
    deploy, that is a dead-end screen for a fault that a reload cures, and it
    is the one the user sees flash before they refresh by hand.

    The reload is started here, in `getDerivedStateFromError`, rather than in
    `componentDidCatch`: this runs BEFORE the error UI is committed, so there
    is nothing to flash. The failing render is replaced by a blank surface in
    the brand's ground while the new document loads.
  */
  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    if (shouldRecoverFromStaleBundle(error)) {
      if (recoverFromStaleBundle(STALE_BUNDLE_SESSION_KEYS.root)) {
        return { error, recovering: true };
      }
    }
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureClientException(error, {
      componentStack: errorInfo.componentStack ?? 'unknown',
      boundary: this.state.recovering
        ? 'root-boundary-auto-recovery'
        : 'root-boundary',
    });
    // Only narrate a failure the user is going to be left looking at.
    if (!this.state.recovering) {
      showBootFailure(error.message || 'Unexpected startup error');
    }
  }

  render() {
    if (this.state.recovering) {
      // Reload is in flight — a blank surface beats flashing an error page.
      return <div className="min-h-[100dvh] bg-white dark:bg-[#0a0a0a]" aria-busy="true" />;
    }

    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6 text-center dark:bg-[#0a0a0a]">
          <div className="max-w-sm space-y-3">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              WIEZ could not start
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {this.state.error.message || 'Unexpected startup error'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;