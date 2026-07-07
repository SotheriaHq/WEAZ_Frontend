import * as Sentry from '@sentry/react';

const dsn = String(import.meta.env.VITE_SENTRY_DSN ?? '').trim();

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
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
  });
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