import { useEffect, useRef } from 'react';

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
export function useOverlayBackClose(
  open: boolean,
  onClose: () => void,
  enabled = true,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Tracks whether our synthetic history entry is still on the stack.
  const entryLiveRef = useRef(false);

  useEffect(() => {
    if (!open || !enabled) return;
    if (typeof window === 'undefined') return;

    // Push a same-URL entry: React Router sees no location change, so it does
    // not re-render a route — but a Back now has something to pop.
    window.history.pushState(
      { ...(window.history.state ?? {}), __threadlyOverlay: true },
      '',
      window.location.href,
    );
    entryLiveRef.current = true;

    const handlePop = () => {
      // Our entry was just popped by a Back gesture/press. Close the overlay
      // in place instead of letting the navigation fall through.
      entryLiveRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
      // Closed programmatically (not via Back): remove the entry we added.
      if (entryLiveRef.current) {
        entryLiveRef.current = false;
        window.history.back();
      }
    };
  }, [open, enabled]);
}

export default useOverlayBackClose;
