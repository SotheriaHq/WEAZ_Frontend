/**
 * Canonical presentation for the user→brand "patch" (follow-like) action.
 *
 * One source of truth for toast copy, button labels, and the two-state colour
 * treatment so every surface (catalog header, design modal, feed card, menu)
 * reads and looks identical (Rule 1). The two states use distinct LIGHT
 * gradients of the WIEZ system colour (purple):
 *   - unpatched ("Patch")    → neutral → purple  (invites the action)
 *   - patched  ("✓ Patched") → purple  → pink    (achieved / held state)
 */

export const PATCH_LABEL = 'Patch';
export const PATCHED_LABEL = 'Patched';
export const PATCH_UPDATING_LABEL = 'Updating…';

/** Standard success toast after a patch/unpatch toggle. */
export function patchToastMessage(
  patched: boolean,
  brandName?: string | null,
): string {
  const brand = brandName?.trim();
  if (patched) {
    return brand
      ? `Patch successful — you're now patched on ${brand}.`
      : 'Patch successful.';
  }
  return brand ? `Unpatched from ${brand}.` : 'Unpatched.';
}

/** Button label for a given patch state. */
export function patchButtonLabel(patched: boolean, loading?: boolean): string {
  if (loading) return PATCH_UPDATING_LABEL;
  return patched ? `✓ ${PATCHED_LABEL}` : PATCH_LABEL;
}

/**
 * Background + text + border colour classes for a patch button/pill.
 * Callers keep their own shape/size/shadow classes and compose this in.
 */
export function patchButtonColorClasses(patched: boolean): string {
  return patched
    ? 'border border-violet-300/70 bg-gradient-to-r from-violet-200 to-pink-200 text-violet-900 hover:from-violet-200 hover:to-pink-300 dark:border-violet-500/40 dark:from-violet-700/50 dark:to-pink-700/40 dark:text-violet-50'
    : 'border border-violet-200 bg-gradient-to-r from-slate-100 to-violet-100 text-violet-800 hover:from-slate-100 hover:to-violet-200 dark:border-violet-700/40 dark:from-slate-800 dark:to-violet-900/50 dark:text-violet-100';
}

/** Subtle tint for a patch action rendered as a dropdown/menu row. */
export function patchMenuRowColorClasses(patched: boolean): string {
  return patched
    ? 'text-violet-700 bg-violet-50 hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-900/25 dark:hover:bg-violet-900/40'
    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10';
}
