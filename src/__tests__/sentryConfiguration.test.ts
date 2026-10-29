import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), setTag: vi.fn(), addIntegration: vi.fn() }));
vi.mock('@sentry/react', () => ({
  init: telemetry.init,
  addIntegration: telemetry.addIntegration,
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
  captureException: telemetry.capture,
  withScope: (callback: (scope: { setTag: typeof telemetry.setTag }) => void) => callback({ setTag: telemetry.setTag }),
}));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

it('does not initialize or capture without a DSN', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', undefined);
  const client = await import('@/observability/sentry');
  client.initSentry();
  client.captureClientException(new Error('unconfigured'));
  expect(telemetry.init).not.toHaveBeenCalled();
  expect(telemetry.capture).not.toHaveBeenCalled();
});

it('reports errors from boot but adds performance tracing only after analytics consent', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', ' https://public@example.invalid/1 ');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'sit');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'release-test');
  vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '0.1');
  const client = await import('@/observability/sentry');
  client.initSentry();
  expect(telemetry.init).toHaveBeenCalledWith(expect.objectContaining({
    dsn: 'https://public@example.invalid/1', environment: 'sit', release: 'release-test',
    integrations: [], tracesSampleRate: 0.1, sendDefaultPii: false,
  }));
  expect(telemetry.addIntegration).not.toHaveBeenCalled();
  // Reports carry the page, never tokens, emails or references from its URL.
  const options = telemetry.init.mock.calls[0][0];
  const scrubbed = options.beforeSend({
    request: {
      url: 'https://weaz.me/reset-password?token=secret-token&email=ada@example.com',
      query_string: 'token=secret-token',
      headers: { Referer: 'https://weaz.me/verify?token=x' },
    },
  });
  expect(scrubbed.request).toEqual({ url: 'https://weaz.me/reset-password', headers: {} });
  expect(options.beforeSendTransaction({ transaction: '/custom-orders/resume/abcdefghijklmnopqrstuvwxyz123456' }).transaction)
    .toBe('/custom-orders/resume/:token');
  expect(options.beforeBreadcrumb({ data: { url: 'https://api.weaz.me/orders/123e4567-e89b-12d3-a456-426614174000?reference=PAY-1' } }).data.url)
    .toBe('https://api.weaz.me/orders/:id');
  client.enableSentryTracing();
  client.enableSentryTracing();
  expect(telemetry.addIntegration).toHaveBeenCalledTimes(1);
  expect(telemetry.addIntegration).toHaveBeenCalledWith({ name: 'BrowserTracing' });
  const error = new Error('configured');
  client.captureClientException(error, { surface: 'viewer' });
  expect(telemetry.setTag).toHaveBeenCalledWith('surface', 'viewer');
  expect(telemetry.capture).toHaveBeenCalledWith(error);
});
