/**
 * Remembers, for a short while, that the server cannot serve the new Market
 * home.
 *
 * The rollout flags live on the server and default to off; while they are off
 * `/market/page` and `/market/catalog` answer 404 and the page renders the
 * established Market instead. Without this memo every visit to Market would
 * pay a 404 round trip before painting, and a server that is shedding load
 * would be asked again by every visit. A switched-off surface (404, or an
 * answer outside the contract) is remembered for ten minutes in this tab; an
 * overloaded one (503) for one minute. Expiry is what ends the fallback, so a
 * server-side switch-on reaches open tabs on a later visit without a loop.
 */
const STORAGE_KEY = 'aru.market.v2.homeUnavailableUntil';
export const MARKET_V2_UNAVAILABLE_TTL_MS = 10 * 60 * 1000;
export const MARKET_V2_BUSY_TTL_MS = 60 * 1000;

let memoryUntil = 0;

const readStored = (): number => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export function isMarketHomeV2KnownUnavailable(now = Date.now()): boolean {
  const until = Math.max(memoryUntil, readStored());
  return until > now;
}

export function markMarketHomeV2Unavailable(now = Date.now(), ttlMs = MARKET_V2_UNAVAILABLE_TTL_MS): void {
  // A shorter memo never cuts an existing longer one.
  memoryUntil = Math.max(memoryUntil, readStored(), now + ttlMs);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(memoryUntil));
  } catch {
    // Storage can be blocked (private mode); the in-memory memo still applies.
  }
}

/** Test seam. */
export function resetMarketHomeV2Availability(): void {
  memoryUntil = 0;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
