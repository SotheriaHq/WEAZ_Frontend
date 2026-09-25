import React from 'react';
import { captureClientException } from '../observability/sentry';

type RootErrorBoundaryProps = {
  children: React.ReactNode;
};

type RootErrorBoundaryState = {
  error: Error | null;
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
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureClientException(error, {
      componentStack: errorInfo.componentStack ?? 'unknown',
    });
    showBootFailure(error.message || 'Unexpected startup error');
  }

  render() {
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