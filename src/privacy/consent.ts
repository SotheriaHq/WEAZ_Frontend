import { useSyncExternalStore } from 'react';

/**
 * The visitor's cookie choice: one versioned record, kept on this device.
 *
 * Essential storage (sign-in, security, the bag, theme) never needs consent and
 * is not modelled here. Everything optional starts off and stays off until the
 * visitor chooses: nothing that measures, profiles or loads a third-party
 * service early may run while `decided` is false.
 *
 * Raise `CONSENT_VERSION` when a new optional purpose is added, so everyone is
 * asked again instead of the new purpose inheriting an old "yes".
 */
export const CONSENT_VERSION = 1;
const STORAGE_KEY = 'wiez.consent';
/** A choice is kept for twelve months, then the visitor is asked again. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type ConsentChoices = {
  /** Page-view analytics and performance measurement. */
  analytics: boolean;
  /** Load Google sign-in when a sign-in page opens, not only on request. */
  thirdPartySignIn: boolean;
};

export type ConsentRecord = ConsentChoices & {
  version: number;
  decidedAt: string;
};

export type ConsentState = {
  record: ConsentRecord | null;
  /** True when a current-version choice exists. */
  decided: boolean;
  /** The visitor asked to review their choice (footer, policy page). */
  settingsOpen: boolean;
};

export const OPTIONAL_OFF: ConsentChoices = {
  analytics: false,
  thirdPartySignIn: false,
};

export const OPTIONAL_ON: ConsentChoices = {
  analytics: true,
  thirdPartySignIn: true,
};

const readRecord = (): ConsentRecord | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed?.version !== CONSENT_VERSION) return null;
    const decidedAt = Date.parse(String(parsed.decidedAt ?? ''));
    if (!Number.isFinite(decidedAt) || Date.now() - decidedAt > CONSENT_MAX_AGE_MS) return null;
    return {
      version: CONSENT_VERSION,
      decidedAt: String(parsed.decidedAt),
      analytics: parsed.analytics === true,
      thirdPartySignIn: parsed.thirdPartySignIn === true,
    };
  } catch {
    return null;
  }
};

const initialRecord = typeof window === 'undefined' ? null : readRecord();
let state: ConsentState = {
  record: initialRecord,
  decided: initialRecord !== null,
  settingsOpen: false,
};

const listeners = new Set<() => void>();

const publish = (next: ConsentState) => {
  state = next;
  for (const listener of listeners) listener();
};

export const getConsentState = (): ConsentState => state;

/** True only for a purpose the visitor has explicitly allowed. */
export const isAllowed = (purpose: keyof ConsentChoices): boolean =>
  state.record?.[purpose] === true;

/** The browser asks sites not to track it (Global Privacy Control or Do Not Track). */
export const browserOptsOutOfTracking = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
  const legacyWindow = window as Window & { doNotTrack?: string };
  return (
    browser.globalPrivacyControl === true ||
    browser.doNotTrack === '1' ||
    legacyWindow.doNotTrack === '1'
  );
};

/**
 * Analytics may run: the visitor allowed them and their browser does not ask
 * otherwise. The cookie policy treats Do Not Track as declining analytics.
 */
export const analyticsPermitted = (): boolean =>
  isAllowed('analytics') && !browserOptsOutOfTracking();

export const subscribeConsent = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const saveConsent = (choices: ConsentChoices) => {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    analytics: choices.analytics === true,
    thirdPartySignIn: choices.thirdPartySignIn === true,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode or full storage: the choice still applies to this visit.
  }
  publish({ record, decided: true, settingsOpen: false });
};

export const openConsentSettings = () => {
  publish({ ...state, settingsOpen: true });
};

export const closeConsentSettings = () => {
  if (!state.settingsOpen) return;
  publish({ ...state, settingsOpen: false });
};

// A choice made in another tab applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const record = readRecord();
    publish({ record, decided: record !== null, settingsOpen: false });
  });
}

export const useConsent = (): ConsentState =>
  useSyncExternalStore(subscribeConsent, getConsentState, getConsentState);
