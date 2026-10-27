import * as Sentry from '@sentry/react';

// Keep the absent configuration statically removable in public builds.
const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

/**
 * Error reports are essential (no cookies, no personal data) and start at
 * boot. Performance tracing measures how people use pages, so it is added
 * only after the visitor allows analytics — see `privacy/thirdPartyLoaders`.
 */
export function initSentry(): void {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment:
      String(import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE).trim() ||
      'development',
    release: String(import.meta.env.VITE_SENTRY_RELEASE ?? '').trim() || undefined,
    integrations: [],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
  });
}

let tracingEnabled = false;

/** Called once the visitor allows analytics. */
export function enableSentryTracing(): void {
  if (!dsn || tracingEnabled) {
    return;
  }
  tracingEnabled = true;
  Sentry.addIntegration(Sentry.browserTracingIntegration());
}

export function captureClientException(
  error: unknown,
  context?: Record<string, string>,
): void {
  if (!dsn) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
