import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/httpClient', () => ({ apiClient: api }));

const rates = (displayCurrency: string, overrides: Record<string, unknown> = {}) => ({
  data: {
    data: {
      baseCurrency: 'NGN',
      chargeCurrency: 'NGN',
      displayCurrency,
      countryCode: displayCurrency === 'GBP' ? 'GB' : null,
      selectionSource: 'COUNTRY',
      countryCurrencies: [displayCurrency],
      needsCurrencyChoice: false,
      isStale: false,
      rates: { NGN: { rate: 1, asOf: '2026-10-27' }, GBP: { rate: 0.00055, asOf: '2026-10-27' } },
      ...overrides,
    },
  },
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ country: 'GB' }))) as typeof fetch;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('display currency', () => {
  it('suggests the currency of the edge country, and charges stay in Naira', async () => {
    api.get.mockResolvedValue(rates('GBP'));
    const currency = await import('@/currency/displayCurrency');
    await currency.ensureDisplayCurrency();

    expect(global.fetch).toHaveBeenCalledWith('/api/location', expect.objectContaining({ credentials: 'omit' }));
    expect(api.get).toHaveBeenCalledWith('/payment/fx/display', { params: { country: 'GB' } });
    const state = currency.getDisplayCurrencyState();
    expect(currency.foreignDisplayCurrency(state)).toBe('GBP');
    expect(currency.estimateInDisplayCurrency(state, 50000, 'NGN')).toMatch(/27\.5/);
    // Only Naira prices are converted; another currency is never re-estimated.
    expect(currency.estimateInDisplayCurrency(state, 50000, 'USD')).toBeNull();
    expect(currency.estimateInDisplayCurrency(state, 0, 'NGN')).toBeNull();
  });

  it('keeps an explicit choice on this device and stops asking for the country', async () => {
    api.get.mockResolvedValue(rates('GBP', { selectionSource: 'EXPLICIT' }));
    const currency = await import('@/currency/displayCurrency');
    await currency.setDisplayCurrencyPreference('GBP');
    expect(localStorage.getItem('wiez.displayCurrency.v1')).toBe('GBP');
    expect(api.get).toHaveBeenLastCalledWith('/payment/fx/display', { params: { currency: 'GBP' } });
    expect(global.fetch).not.toHaveBeenCalled();

    vi.resetModules();
    const reloaded = await import('@/currency/displayCurrency');
    expect(reloaded.getDisplayCurrencyState().preference).toBe('GBP');

    await reloaded.setDisplayCurrencyPreference('AUTO');
    expect(localStorage.getItem('wiez.displayCurrency.v1')).toBeNull();
  });

  it('shows Naira only when rates are unavailable', async () => {
    api.get.mockRejectedValue(new Error('503'));
    const currency = await import('@/currency/displayCurrency');
    await currency.ensureDisplayCurrency();
    const state = currency.getDisplayCurrencyState();
    expect(currency.foreignDisplayCurrency(state)).toBeNull();
    expect(currency.estimateInDisplayCurrency(state, 50000, 'NGN')).toBeNull();
  });

  it('shows no estimate for a shopper reading Naira', async () => {
    api.get.mockResolvedValue(rates('NGN'));
    const { PriceEstimate } = await import('@/currency/PriceEstimate');
    const { container } = render(<PriceEstimate amount={50000} currency="NGN" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('states the Naira charge at checkout next to the estimate', async () => {
    api.get.mockResolvedValue(rates('GBP'));
    const { ChargeCurrencyNotice, PriceEstimate } = await import('@/currency/PriceEstimate');
    render(
      <MemoryRouter>
        <PriceEstimate amount={50000} currency="NGN" />
        <ChargeCurrencyNotice total={50000} currency="NGN" />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/You.ll pay .*50,000 in Naira/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change currency' })).toHaveAttribute('href', '/settings?tab=currency');
    expect(screen.getAllByText(/27\.5/).length).toBeGreaterThan(0);
  });
});
