/**
 * A durable, locally generated id for this browser.
 *
 * It is NOT a session id despite the storage key's history — it survives
 * reloads, tab closes, sign-out and sign-in, which is exactly the property view
 * counting needs: the same person viewing an item signed out and then signed in
 * must not be counted twice.
 *
 * It identifies a browser, never a person, and the server treats it as
 * untrusted input used only to suppress a count. It is deliberately not sent
 * anywhere else and grants no authority.
 *
 * Lives in its own module with no imports so both `httpClient` (which sets the
 * header) and `marketSignalQueue` (which sends it in signal batches) can use it
 * without importing each other.
 */
export const WEB_DEVICE_ID_STORAGE_KEY = 'wiez.market.anonymousSessionId.v1';

export const WIEZ_DEVICE_ID_HEADER = 'x-wiez-device-id';

const createId = () => {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `anon_${random}`;
};

/**
 * Returns null rather than a fresh id when storage is unavailable — a private
 * window, or a browser with site data blocked. A per-request id would defeat
 * dedupe entirely and inflate every count, so no id is the safer answer.
 */
export const getWebDeviceId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(WEB_DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = createId();
    window.localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
};
