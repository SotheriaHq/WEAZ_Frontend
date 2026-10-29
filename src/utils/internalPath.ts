const PROBE_ORIGIN = 'https://wiez.invalid';

/** Backslash, or a control character a URL parser would silently drop. */
function hasUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/**
 * A path on this site taken from untrusted input (`?returnTo=`, `?next=`), or
 * `fallback`.
 *
 * Prefix checks are not enough. Browsers read `\` as `/` and drop tabs and
 * newlines, so `/\evil.com` and `/\t/evil.com` both mean `//evil.com`. And
 * react-router's `navigate()` is not a guard: when `pushState` refuses a
 * cross-origin URL, its history falls back to `window.location.assign`, so
 * `navigate('//evil.com')` leaves the site. The URL parser decides instead,
 * against a probe origin, and only a result on that origin is returned.
 */
export function toInternalPath<T extends string | null = null>(
  raw: unknown,
  fallback: T = null as T,
): string | T {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || hasUnsafeCharacter(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, PROBE_ORIGIN);
    if (parsed.origin !== PROBE_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
