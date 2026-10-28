import { useEffect, useSyncExternalStore } from 'react';
import { apiClient } from '@/api/httpClient';

/**
 * The currency a shopper reads prices in. Display only: everything is priced,
 * charged and settled in Naira, and other currencies are estimates.
 *
 * Chosen in this order: the shopper's own choice (kept on this device), their
 * country (Cloudflare's edge country from `/api/location`, never stored), then
 * Naira. A country with several currencies asks instead of guessing.
 */
export const BASE_CURRENCY = 'NGN';
export const AUTO_CURRENCY = 'AUTO';
const PREFERENCE_KEY = 'wiez.displayCurrency.v1';
const REFRESH_MS = 60 * 60 * 1000;
const HINT_TIMEOUT_MS = 3000;

export type DisplayRates = {
  baseCurrency: string;
  chargeCurrency: string;
  displayCurrency: string;
  countryCode: string | null;
  selectionSource: 'EXPLICIT' | 'COUNTRY' | 'BASE_FALLBACK';
  countryCurrencies: string[];
  needsCurrencyChoice: boolean;
  isStale: boolean;
  rates: Record<string, { rate: number; asOf: string }>;
};

export type DisplayCurrencyState = {
  /** `AUTO`, or the ISO code the shopper picked. */
  preference: string;
  data: DisplayRates | null;
  loadedAt: number;
};

const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value);

const readPreference = (): string => {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_KEY);
    return isCurrencyCode(stored) ? stored : AUTO_CURRENCY;
  } catch {
    return AUTO_CURRENCY;
  }
};

let state: DisplayCurrencyState = {
  preference: typeof window === 'undefined' ? AUTO_CURRENCY : readPreference(),
  data: null,
  loadedAt: 0,
};
const listeners = new Set<() => void>();
const publish = (next: DisplayCurrencyState) => {
  state = next;
  for (const listener of listeners) listener();
};

export const getDisplayCurrencyState = () => state;
export const subscribeDisplayCurrency = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let countryHint: Promise<string | null> | null = null;

/** The visitor's country as Cloudflare sees it; nothing is stored. */
const loadCountryHint = (): Promise<string | null> => {
  if (!countryHint) {
    countryHint = fetch('/api/location', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(HINT_TIMEOUT_MS),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { country?: unknown } | null) =>
        typeof body?.country === 'string' && /^[A-Z]{2}$/.test(body.country) ? body.country : null,
      )
      .catch(() => null);
  }
  return countryHint;
};

let loading: Promise<void> | null = null;

/** Loads rates once an hour, or after the preference changes. Never throws. */
export const ensureDisplayCurrency = (force = false): Promise<void> => {
  if (!force && state.data && Date.now() - state.loadedAt < REFRESH_MS) return Promise.resolve();
  if (loading && !force) return loading;
  const preference = state.preference;
  loading = (async () => {
    try {
      const country = preference === AUTO_CURRENCY ? await loadCountryHint() : null;
      const response = await apiClient.get('/payment/fx/display', {
        params: {
          ...(preference !== AUTO_CURRENCY ? { currency: preference } : {}),
          ...(country ? { country } : {}),
        },
      });
      const data = (response?.data?.data ?? response?.data) as DisplayRates | undefined;
      // A newer choice made while this loaded wins.
      if (data && isCurrencyCode(data.displayCurrency) && state.preference === preference) {
        publish({ ...state, data, loadedAt: Date.now() });
      }
    } catch {
      // Rates unavailable: prices show in Naira only, which is always correct.
    } finally {
      loading = null;
    }
  })();
  return loading;
};

export const setDisplayCurrencyPreference = (preference: string) => {
  const next = isCurrencyCode(preference) ? preference : AUTO_CURRENCY;
  try {
    if (next === AUTO_CURRENCY) window.localStorage.removeItem(PREFERENCE_KEY);
    else window.localStorage.setItem(PREFERENCE_KEY, next);
  } catch {
    // Private mode: the choice still applies to this visit.
  }
  publish({ ...state, preference: next, data: null, loadedAt: 0 });
  return ensureDisplayCurrency(true);
};

/** The shopper's currency, or null when it is Naira or rates are unavailable. */
export const foreignDisplayCurrency = (current: DisplayCurrencyState): string | null => {
  const display = current.data?.displayCurrency;
  if (!display || display === BASE_CURRENCY || !current.data?.rates[display]) return null;
  return display;
};

export const formatMoneyAmount = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

/** "£27.53" for a Naira amount, or null when no estimate should be shown. */
export const estimateInDisplayCurrency = (
  current: DisplayCurrencyState,
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null => {
  const display = foreignDisplayCurrency(current);
  if (!display || amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  if (String(currency ?? BASE_CURRENCY).toUpperCase() !== BASE_CURRENCY) return null;
  const rate = current.data!.rates[display].rate;
  return formatMoneyAmount(amount * rate, display);
};

export const useDisplayCurrency = (): DisplayCurrencyState => {
  const current = useSyncExternalStore(
    subscribeDisplayCurrency,
    getDisplayCurrencyState,
    getDisplayCurrencyState,
  );
  useEffect(() => {
    void ensureDisplayCurrency();
  }, []);
  return current;
};
