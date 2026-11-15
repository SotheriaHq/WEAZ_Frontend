import { useEffect, useRef } from 'react';

/**
 * Shared channel between overlay back-close entries and MobileExitGuard so
 * the guard can tell WHICH popstate events belong to overlays (and must be
 * left alone) versus real user gesture-backs it should handle.
 *
 * Ordering guarantee: MobileExitGuard registers its popstate listener at app
 * mount, overlays register later — so on a gesture back the guard's handler
 * runs first, sees `depth > 0`, and yields; the overlay's handler then closes
 * the overlay.
 */
let overlayDepth = 0;

export const overlayBackChannel = {
  /** An overlay pushed its synthetic history entry. */
  armed() {
    overlayDepth += 1;
  },
  /** The synthetic entry left the stack (gesture pop or programmatic pop).
   *  Programmatic pops (✕ / backdrop → history.back()) are additionally
   *  flagged by MobileExitGuard's history wrapper, so depth is enough here. */
  popped() {
    overlayDepth = Math.max(0, overlayDepth - 1);
  },
  /** MobileExitGuard: is a live overlay entry consuming this popstate? */
  consumesPop() {
    return overlayDepth > 0;
  },
};

/**
 * useOverlayBackClose — make the browser/OS Back gesture close an open overlay
 * (modal, sheet, lightbox) instead of navigating away from the page that
 * opened it.
 *
 * THE BUG THIS FIXES: an overlay rendered via a portal is not a history entry,
 * so a mobile back-swipe pops the underlying ROUTE — e.g. opening a design from
 * the Runway and swiping back dumped the user into their catalog. By pushing a
 * throwaway history entry (same URL, so React Router never changes routes) when
 * the overlay opens, the first Back pops that entry and we close the overlay in
 * place; the user stays exactly where they were.
 *
 * On programmatic close (the ✕ button / backdrop tap) we pop our own entry so
 * history never accumulates a dead state that would need an extra Back later.
 */
type OverlayEntry = { parentId: string | null; href: string };
const activeEntries = new Map<string, OverlayEntry>();
const closingEntries = new Map<string, OverlayEntry>();
let entrySequence = 0;
let closeFlushQueued = false;
const entryIdFrom = (state: unknown): string | null => state && typeof state === 'object' &&
  '__wiezOverlayId' in state && typeof state.__wiezOverlayId === 'string' ? state.__wiezOverlayId : null;
function containsEntry(destination: string | null, ancestor: string) {
  for (let count = 0; destination && count <= activeEntries.size + closingEntries.size; count++) {
    if (destination === ancestor) return true;
    destination = (activeEntries.get(destination) ?? closingEntries.get(destination))?.parentId ?? null;
  }
  return false;
}
function closeHistoryEntry(id: string, entry: OverlayEntry) {
  closingEntries.set(id, entry);
  scheduleHistoryClose();
}
function scheduleHistoryClose() {
  if (closeFlushQueued) return;
  closeFlushQueued = true;
  // React can remove several nested overlays in one commit. Pop only the
  // entries still at the top; never undo a newer route or unrelated state.
  queueMicrotask(() => {
    closeFlushQueued = false;
    let current = entryIdFrom(window.history.state), count = 0;
    const limit = closingEntries.size;
    while (current && count < limit) {
      const closing = closingEntries.get(current);
      if (!closing || closing.href !== window.location.href) break;
      count++; current = closing.parentId;
    }
    // Retired ancestors remain owned until their live descendants close.
    // Forget entries outside the current chain after unrelated navigation.
    const reachable = new Set<string>();
    let ancestor = entryIdFrom(window.history.state);
    const bound = activeEntries.size + closingEntries.size;
    for (let steps = 0; ancestor && steps <= bound; steps++) {
      reachable.add(ancestor);
      ancestor = (activeEntries.get(ancestor) ?? closingEntries.get(ancestor))?.parentId ?? null;
    }
    for (const key of closingEntries.keys()) if (!reachable.has(key)) closingEntries.delete(key);
    let popped = entryIdFrom(window.history.state);
    for (let steps = 0; popped && steps < count; steps++) {
      const parent = closingEntries.get(popped)?.parentId ?? null;
      closingEntries.delete(popped); popped = parent;
    }
    if (count === 1) window.history.back();
    else if (count > 1) window.history.go(-count);
  });
}

export function useOverlayBackClose(
  open: boolean,
  onClose: () => void,
  enabled = true,
) {
  const onCloseRef = useRef(onClose);
  const ownedId = useRef<string | null>(null);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !enabled || typeof window === 'undefined') return;
    const href = window.location.href;
    const previousId = entryIdFrom(window.history.state);
    const prior = ownedId.current ? closingEntries.get(ownedId.current) : undefined;
    let candidate = previousId;
    let reclaim = false;
    for (let count = 0; candidate && count <= activeEntries.size + closingEntries.size; count++) {
      if (candidate === ownedId.current && prior?.href === href) { reclaim = true; break; }
      candidate = (activeEntries.get(candidate) ?? closingEntries.get(candidate))?.parentId ?? null;
    }
    const retiring = previousId ? closingEntries.get(previousId) : undefined;
    const replace = retiring?.href === href;
    const id = reclaim ? ownedId.current! : String(Date.now()) + ':' + String(++entrySequence);
    const entry = reclaim ? prior! : { parentId: replace ? retiring.parentId : previousId, href };
    const state = { ...window.history.state, __wiezOverlay: true, __wiezOverlayId: id };
    // Strict Mode replays nested effects parent-first. Reclaim each hook's
    // original entry in place, even while a retiring child is above it.
    if (reclaim) closingEntries.delete(id);
    else if (replace) {
      closingEntries.delete(previousId!);
      window.history.replaceState(state, '', href);
    } else window.history.pushState(state, '', href);
    ownedId.current = id;
    activeEntries.set(id, entry);
    overlayBackChannel.armed();
    let live = true;
    const handlePop = () => {
      // Back from a child into this entry leaves this parent open.
      if (!live || containsEntry(entryIdFrom(window.history.state), id)) return;
      live = false; activeEntries.delete(id); overlayBackChannel.popped();
      onCloseRef.current();
      scheduleHistoryClose();
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      activeEntries.delete(id);
      if (live) {
        live = false; overlayBackChannel.popped(); closeHistoryEntry(id, entry);
      }
    };
  }, [open, enabled]);
}

export default useOverlayBackClose;
