const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function hashSeed(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function nextDigit(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next % 10, next];
}

/** Opening letters of every WIEZ user UID. */
export const USER_UID_PREFIX = 'WIE';
/** Closing letter of every WIEZ user UID. */
export const USER_UID_SUFFIX = 'Z';
/** Digits between the account initial and the closing letter. */
const USER_UID_DIGIT_COUNT = 10;

/**
 * A stable, display-only account identifier: `WIE` + the account's initial +
 * ten digits + `Z` (e.g. `WIEJ4820175639Z`).
 *
 * It is DERIVED from the user id, never stored — no column, no backend
 * generator, no other client (this is the only implementation in the
 * workspace). Changing the shape therefore changes the UID shown for existing
 * accounts; nothing persisted refers to the old one.
 *
 * The previous shape opened with `VGL`, from when the product was called
 * Voguely. The product is WIEZ, so the UID reads WIE…Z: the brand wraps the
 * identifier instead of naming a company that no longer exists.
 *
 * Total length is unchanged at 15 characters — one digit was traded for the
 * closing `Z` — so anything laid out around a UID keeps its measurements.
 */
export function generateUserUid(userId: string, firstName?: string | null): string {
  const initialRaw = (firstName ?? '').trim().charAt(0).toUpperCase();
  const initial = /^[A-Z]$/.test(initialRaw) ? initialRaw : 'X';

  let state = hashSeed(`${userId}:${firstName ?? ''}`);
  let digits = '';
  for (let i = 0; i < USER_UID_DIGIT_COUNT; i += 1) {
    const [digit, nextState] = nextDigit(state);
    digits += String(digit);
    state = nextState;
  }

  return `${USER_UID_PREFIX}${initial}${digits}${USER_UID_SUFFIX}`;
}
