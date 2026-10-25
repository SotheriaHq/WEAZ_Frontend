import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), setTag: vi.fn() }));
vi.mock('@sentry/react', () => ({
  init: telemetry.init,
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

it('retains configured tracing, privacy settings and tagged exception capture', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', ' https://public@example.invalid/1 ');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'sit');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'release-test');
  vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '0.1');
  const client = await import('@/observability/sentry');
  client.initSentry();
  expect(telemetry.init).toHaveBeenCalledWith({
    dsn: 'https://public@example.invalid/1', environment: 'sit', release: 'release-test',
    integrations: [{ name: 'BrowserTracing' }], tracesSampleRate: 0.1, sendDefaultPii: false,
  });
  const error = new Error('configured');
  client.captureClientException(error, { surface: 'viewer' });
  expect(telemetry.setTag).toHaveBeenCalledWith('surface', 'viewer');
  expect(telemetry.capture).toHaveBeenCalledWith(error);
});
