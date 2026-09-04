/**
 * Which garment's size the PROFILE shows.
 *
 * The profile used to render every category the engine could compute — Tops,
 * Bottoms, Dresses, Shirts, Jackets — plus the alpha fit label, plus eight
 * measurement chips, plus a "Sized against" chart switcher. That is the sizing
 * surface's job. The profile needs to answer one question at a glance ("what
 * size am I?"), and the shopper is the only one who knows which garment that
 * means for them.
 *
 * Stored in `localStorage` rather than on the account, deliberately: this is a
 * display choice about one screen, and nothing else — no brand, no order, no
 * recommendation — reads it. Keeping it local avoids a schema change and a
 * round trip for something that must be instant.
 *
 * Deliberate twin of `threadly-mobile/src/features/sizing/profileSizePreference.ts`.
 * Separate repos, so change both or the two surfaces disagree about which size
 * a shopper chose. `resolveDisplayCategory` is behaviourally identical and is
 * covered by a cross-repo contract test.
 */
const STORAGE_KEY = 'wiez.profile.sizeCategory.v1';

export function readProfileSizeCategory(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private window, or site data blocked. Falls back to the first category.
    return null;
  }
}

export function writeProfileSizeCategory(category: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (category) window.localStorage.setItem(STORAGE_KEY, category);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A display preference is not worth surfacing a failure for.
  }
}

/**
 * The category the profile should display.
 *
 * Falls back to the first computed category so a shopper who has never chosen
 * still sees a size, and falls back again if the chosen category stops being
 * computable (measurements removed, chart withdrawn) — without this, reducing
 * the profile from five pills to one would leave it blank.
 */
export function resolveDisplayCategory(
  preferred: string | null,
  available: Array<{ key: string }>,
): string | null {
  if (available.length === 0) return null;
  if (preferred && available.some((entry) => entry.key === preferred)) {
    return preferred;
  }
  return available[0].key;
}
