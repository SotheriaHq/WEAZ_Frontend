import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSubscriptionQuoteFresh, subscriptionQuoteRemainingMs, timeSubscriptionQuote } from './subscriptionQuote';

const wire = { quoteId: '11111111-1111-4111-8111-111111111111', serverNow: '2026-11-02T12:00:00.000Z', expiresAt: '2026-11-02T12:05:00.000Z' };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('held subscription quote clocks', () => {
  it('counts request latency against validity and ignores a wrong wall clock', () => {
    let now = 1300;
    vi.stubGlobal('performance', { now: () => now });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2040-01-01T00:00:00Z'));
    const quote = timeSubscriptionQuote(wire, 'brand-a', 1000);
    expect(subscriptionQuoteRemainingMs(quote)).toBe(299700);
    expect(() => assertSubscriptionQuoteFresh(quote, 'brand-a')).not.toThrow();
    now = 301000;
    expect(() => assertSubscriptionQuoteFresh(quote, 'brand-a')).toThrow('fresh price');
  });
  it('rejects another brand without making the price transferable', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const quote = timeSubscriptionQuote(wire, 'brand-a', 1000);
    expect(() => assertSubscriptionQuoteFresh(quote, 'brand-b')).toThrow('fresh price');
  });
  it.each([null, { ...wire, quoteId: undefined }, { ...wire, expiresAt: 'invalid' },
    { ...wire, expiresAt: wire.serverNow }, { ...wire, expiresAt: '2026-11-02T13:00:00Z' }])('rejects malformed or unsupported quote timing', (value) => {
    expect(() => timeSubscriptionQuote(value as typeof wire, 'brand-a', 1000)).toThrow('fresh price');
  });
});
