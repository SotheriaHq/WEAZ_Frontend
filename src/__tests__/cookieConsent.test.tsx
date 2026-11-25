import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ enableSentryTracing: vi.fn() }));
vi.mock('@/observability/sentry', () => sentry);

const GA_ID = 'G-TEST123';
const gaScripts = () =>
  document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]');

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
  delete window.gtag;
  delete window.dataLayer;
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', GA_ID);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('consent-gated third parties', () => {
  it('loads nothing optional before the visitor chooses', async () => {
    const { initConsentEffects } = await import('@/privacy/thirdPartyLoaders');
    initConsentEffects();
    expect(gaScripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(sentry.enableSentryTracing).not.toHaveBeenCalled();
  });

  it('starts analytics once after Accept, and never after Reject', async () => {
    const consent = await import('@/privacy/consent');
    const { initConsentEffects } = await import('@/privacy/thirdPartyLoaders');
    initConsentEffects();

    consent.saveConsent(consent.OPTIONAL_OFF);
    expect(gaScripts()).toHaveLength(0);

    consent.saveConsent(consent.OPTIONAL_ON);
    consent.saveConsent(consent.OPTIONAL_ON);
    expect(gaScripts()).toHaveLength(1);
    expect(typeof window.gtag).toBe('function');
    expect(sentry.enableSentryTracing).toHaveBeenCalledTimes(1);
  });

  it('declares consent before config and sends Google only a cleaned address', async () => {
    window.history.pushState({}, '', '/reset-password?token=secret-reset-token&email=ada@example.com');
    const consent = await import('@/privacy/consent');
    const { initConsentEffects } = await import('@/privacy/thirdPartyLoaders');
    initConsentEffects();
    consent.saveConsent(consent.OPTIONAL_ON);

    const commands = (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    const names = commands.map((command) => `${command[0]}:${String(command[1])}`);
    expect(names.indexOf('consent:default')).toBeLessThan(names.findIndex((name) => name.startsWith('config:')));
    expect(commands.find((command) => command[0] === 'consent')?.[2]).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    expect(commands.find((command) => command[0] === 'config')?.[2]).toMatchObject({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const pageView = commands.find((command) => command[0] === 'event' && command[1] === 'page_view');
    expect((pageView?.[2] as { page_location: string }).page_location).toMatch(/\/reset-password$/);
    expect(JSON.stringify(commands)).not.toMatch(/secret-reset-token|ada@example\.com/);
    window.history.pushState({}, '', '/');
  });

  it('counts the first page once on a returning visit, then one view per route', async () => {
    window.history.pushState({}, '', '/runway');
    const consent = await import('@/privacy/consent');
    consent.saveConsent(consent.OPTIONAL_ON);
    const { initConsentEffects } = await import('@/privacy/thirdPartyLoaders');
    const { trackPageView } = await import('@/observability/analytics');
    initConsentEffects();
    // The router reports the same first page the loader already counted.
    trackPageView('/runway');
    trackPageView('/market');
    trackPageView('/market?tab=new');

    const pageViews = (window.dataLayer ?? [])
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .filter((command) => command[0] === 'event' && command[1] === 'page_view')
      .map((command) => (command[2] as { page_location: string }).page_location);
    expect(pageViews).toEqual([`${window.location.origin}/runway`, `${window.location.origin}/market`]);
    window.history.pushState({}, '', '/');
  });

  it('withdrawal stops analytics: disables GA, clears its cookies and reloads', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      hostname: 'localhost',
      reload,
    } as Location);
    document.cookie = '_ga=GA1.1.1; path=/';
    const consent = await import('@/privacy/consent');
    const { initConsentEffects } = await import('@/privacy/thirdPartyLoaders');
    initConsentEffects();
    consent.saveConsent(consent.OPTIONAL_ON);

    consent.saveConsent(consent.OPTIONAL_OFF);
    expect(window[`ga-disable-${GA_ID}`]).toBe(true);
    expect(document.cookie).not.toMatch(/_ga=/);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('remembers a choice for the next visit, and asks again when the version changes or a year passes', async () => {
    const first = await import('@/privacy/consent');
    first.saveConsent(first.OPTIONAL_OFF);
    vi.resetModules();
    const next = await import('@/privacy/consent');
    expect(next.getConsentState().decided).toBe(true);

    localStorage.clear();
    localStorage.setItem('wiez.consent', JSON.stringify({ version: 0, analytics: true }));
    vi.resetModules();
    const outdated = await import('@/privacy/consent');
    expect(outdated.getConsentState().decided).toBe(false);
    expect(outdated.isAllowed('analytics')).toBe(false);

    localStorage.clear();
    const thirteenMonthsAgo = new Date(Date.now() - 395 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('wiez.consent', JSON.stringify({ version: 1, decidedAt: thirteenMonthsAgo, analytics: true }));
    vi.resetModules();
    const expired = await import('@/privacy/consent');
    expect(expired.getConsentState().decided).toBe(false);
    expect(expired.analyticsPermitted()).toBe(false);
  });

  it('dual-reads legacy wiez.consent, migrates to aru.consent, and retires legacy without resetting user choice', async () => {
    localStorage.clear();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const legacyChoice = {
      version: 1,
      decidedAt: oneDayAgo,
      analytics: true,
      thirdPartySignIn: false,
    };
    localStorage.setItem('wiez.consent', JSON.stringify(legacyChoice));

    vi.resetModules();
    const consent = await import('@/privacy/consent');
    const state = consent.getConsentState();
    expect(state.decided).toBe(true);
    expect(state.record?.analytics).toBe(true);
    expect(state.record?.thirdPartySignIn).toBe(false);
    expect(consent.isAllowed('analytics')).toBe(true);
    expect(consent.isAllowed('thirdPartySignIn')).toBe(false);

    // Verified opportunistic migration: aru.consent populated, wiez.consent retired
    expect(localStorage.getItem('aru.consent')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('aru.consent')!)).toMatchObject({
      version: 1,
      analytics: true,
      thirdPartySignIn: false,
    });
    expect(localStorage.getItem('wiez.consent')).toBeNull();

    // Saving updates aru.consent and keeps wiez.consent cleared
    consent.saveConsent(consent.OPTIONAL_OFF);
    expect(JSON.parse(localStorage.getItem('aru.consent')!)).toMatchObject({
      analytics: false,
      thirdPartySignIn: false,
    });
    expect(localStorage.getItem('wiez.consent')).toBeNull();

    localStorage.clear();
    vi.resetModules();
  });
});

describe('telemetry addresses', () => {
  it('drop queries and fragments and replace ids, tokens and emails in the path', async () => {
    const { telemetryPath, telemetryUrl } = await import('@/privacy/telemetryUrl');
    expect(telemetryUrl('https://weaz.me/checkout/return?reference=PAY-123&trxref=x#done')).toBe(
      'https://weaz.me/checkout/return',
    );
    expect(telemetryPath('/orders/123e4567-e89b-12d3-a456-426614174000')).toBe('/orders/:id');
    expect(telemetryPath('/custom-orders/resume/AbCdEf0123456789AbCdEf0123')).toBe('/custom-orders/resume/:token');
    expect(telemetryPath('/u/ada%40example.com')).toBe('/u/:token');
    expect(telemetryPath('/market/ankara-midi-dress')).toBe('/market/ankara-midi-dress');
    expect(telemetryUrl('')).toBe('');
    expect(telemetryUrl('http://[broken')).toBe('');
  });
});

describe('cookie banner', () => {
  const renderBanner = async () => {
    const { default: CookieConsent } = await import('@/components/privacy/CookieConsent');
    return render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>,
    );
  };

  it('offers Accept and Reject with equal weight and no optional default', async () => {
    await renderBanner();
    const accept = screen.getByRole('button', { name: 'Accept all' });
    const reject = screen.getByRole('button', { name: 'Reject optional' });
    expect(accept.className).toBe(reject.className);
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookies');

    fireEvent.click(screen.getByRole('button', { name: /choose what to allow/i }));
    for (const toggle of screen.getAllByRole('switch')) {
      if (!(toggle as HTMLButtonElement).disabled) expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('saves Reject, hides, and reopens for review with the saved choices', async () => {
    await renderBanner();
    const consent = await import('@/privacy/consent');
    fireEvent.click(screen.getByRole('button', { name: 'Reject optional' }));
    expect(consent.getConsentState().record).toMatchObject({ analytics: false, thirdPartySignIn: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    consent.openConsentSettings();
    expect(await screen.findByText('Choose your cookies')).toBeInTheDocument();
    const analytics = screen.getByRole('switch', { name: 'Analytics' });
    expect(analytics).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(analytics);
    fireEvent.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(consent.getConsentState().record).toMatchObject({ analytics: true, thirdPartySignIn: false });
  });

  it('closes a review with Escape without changing the saved choice', async () => {
    const consent = await import('@/privacy/consent');
    consent.saveConsent(consent.OPTIONAL_ON);
    await renderBanner();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    consent.openConsentSettings();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(consent.getConsentState().record).toMatchObject({ analytics: true });
  });
});

describe('executable privacy consent failure paths (PC-01 to PC-15)', () => {
  const now = new Date().toISOString();
  const validApproval = JSON.stringify({ version: 1, decidedAt: now, analytics: true, thirdPartySignIn: true });
  const validRefusal = JSON.stringify({ version: 1, decidedAt: now, analytics: false, thirdPartySignIn: false });

  it('PC-01: Legacy refusal only -> refusal preserved without re-prompting', async () => {
    localStorage.setItem('wiez.consent', validRefusal);
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(true);
    expect(consent.isAllowed('analytics')).toBe(false);
    expect(consent.analyticsPermitted()).toBe(false);
    expect(localStorage.getItem('aru.consent')).toBeTruthy();
    expect(localStorage.getItem('wiez.consent')).toBeNull();
  });

  it('PC-02: Legacy approval only -> approved scope preserved and migrated', async () => {
    localStorage.setItem('wiez.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(true);
    expect(consent.isAllowed('analytics')).toBe(true);
    expect(consent.analyticsPermitted()).toBe(true);
    expect(localStorage.getItem('aru.consent')).toBeTruthy();
    expect(localStorage.getItem('wiez.consent')).toBeNull();
  });

  it('PC-03: ARU and WIEZ records agree -> canonical primary state retained', async () => {
    localStorage.setItem('aru.consent', validApproval);
    localStorage.setItem('wiez.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(true);
    expect(consent.isAllowed('analytics')).toBe(true);
  });

  it('PC-04: ARU and WIEZ records conflict -> primary key takes absolute precedence', async () => {
    localStorage.setItem('aru.consent', validApproval);
    localStorage.setItem('wiez.consent', validRefusal);
    const consent = await import('@/privacy/consent');
    expect(consent.isAllowed('analytics')).toBe(true);
  });

  it('PC-05: Corrupted ARU record, valid legacy record -> safe fallback and recovery', async () => {
    localStorage.setItem('aru.consent', '{ corrupt json');
    localStorage.setItem('wiez.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(true);
    expect(consent.isAllowed('analytics')).toBe(true);
    expect(localStorage.getItem('wiez.consent')).toBeNull();
    expect(JSON.parse(localStorage.getItem('aru.consent')!)).toMatchObject({ analytics: true });
  });

  it('PC-06: Valid ARU record, corrupted legacy record -> canonical state retained', async () => {
    localStorage.setItem('aru.consent', validRefusal);
    localStorage.setItem('wiez.consent', '{ corrupt json');
    const consent = await import('@/privacy/consent');
    expect(consent.isAllowed('analytics')).toBe(false);
  });

  it('PC-07: Both records corrupted -> safe default (decided=false, analytics=false)', async () => {
    localStorage.setItem('aru.consent', '{ bad');
    localStorage.setItem('wiez.consent', '{ also bad');
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(false);
    expect(consent.isAllowed('analytics')).toBe(false);
    expect(consent.analyticsPermitted()).toBe(false);
  });

  it('PC-08: Canonical write fails -> error safely handled, no unauthorized consent', async () => {
    const consent = await import('@/privacy/consent');
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(() => consent.saveConsent(consent.OPTIONAL_OFF)).not.toThrow();
      expect(consent.isAllowed('analytics')).toBe(false);
    } finally {
      setSpy.mockRestore();
    }
  });

  it('PC-09: Read-back fails or mismatches -> legacy key protected against deletion', async () => {
    localStorage.setItem('wiez.consent', validApproval);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'aru.consent') return 'corrupted-readback-mismatch';
      if (key === 'wiez.consent') return validApproval;
      return null;
    });
    try {
      await import('@/privacy/consent');
      expect(removeSpy).not.toHaveBeenCalledWith('wiez.consent');
    } finally {
      getItemSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('PC-10: Legacy deletion fails -> primary write verified, safe repeatable migration', async () => {
    localStorage.setItem('wiez.consent', validApproval);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      if (key === 'wiez.consent') throw new Error('Permission denied');
    });
    try {
      const consent = await import('@/privacy/consent');
      expect(consent.isAllowed('analytics')).toBe(true);
      expect(localStorage.getItem('aru.consent')).toBeTruthy();
    } finally {
      removeSpy.mockRestore();
    }
  });

  it('PC-11: Analytics withdrawn in another tab -> tracking permission revoked', async () => {
    localStorage.setItem('aru.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.analyticsPermitted()).toBe(true);

    localStorage.setItem('aru.consent', validRefusal);
    window.dispatchEvent(new StorageEvent('storage', { key: 'aru.consent', newValue: validRefusal }));

    expect(consent.isAllowed('analytics')).toBe(false);
    expect(consent.analyticsPermitted()).toBe(false);
  });

  it('PC-12: Conflicting cross-tab storage events -> safe canonical state maintained', async () => {
    localStorage.setItem('aru.consent', validRefusal);
    const consent = await import('@/privacy/consent');
    expect(consent.isAllowed('analytics')).toBe(false);

    window.dispatchEvent(new StorageEvent('storage', { key: 'wiez.consent', newValue: validApproval }));
    expect(consent.isAllowed('analytics')).toBe(false);
  });

  it('PC-13: Reload after interrupted migration -> existing decision preserved', async () => {
    localStorage.setItem('aru.consent', validApproval);
    localStorage.setItem('wiez.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(true);
    expect(consent.isAllowed('analytics')).toBe(true);
  });

  it('PC-14: No valid consent exists -> optional integrations remain strictly gated', async () => {
    const consent = await import('@/privacy/consent');
    expect(consent.getConsentState().decided).toBe(false);
    expect(consent.isAllowed('analytics')).toBe(false);
    expect(consent.analyticsPermitted()).toBe(false);
  });

  it('PC-15: Consent withdrawal -> no unauthorized reactivation', async () => {
    localStorage.setItem('aru.consent', validApproval);
    const consent = await import('@/privacy/consent');
    expect(consent.analyticsPermitted()).toBe(true);

    consent.saveConsent(consent.OPTIONAL_OFF);
    expect(consent.isAllowed('analytics')).toBe(false);
    expect(consent.analyticsPermitted()).toBe(false);
    expect(localStorage.getItem('wiez.consent')).toBeNull();
  });
});
