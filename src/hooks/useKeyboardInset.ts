import { useEffect, useState } from 'react';

/**
 * How much of the viewport the on-screen keyboard is currently covering.
 *
 * Mobile browsers do NOT shrink the layout viewport when the keyboard opens —
 * `100vh`, `100dvh` and `position: fixed; inset: 0` all keep their full height
 * and the keyboard is drawn on top. So a full-height modal keeps rendering its
 * bottom half underneath the keyboard, and any field down there is unreachable:
 * the user cannot see what they are typing and cannot scroll to it, because the
 * modal's own scroll container also believes it has the full height.
 *
 * `window.visualViewport` is the only thing that reports the real visible box.
 * The inset below is the gap between the layout viewport bottom and the visual
 * viewport bottom — i.e. exactly the keyboard (plus any collapsed browser UI).
 *
 * Also published as the CSS variable `--keyboard-inset` on :root so overlays
 * that are not React-controlled can use it directly.
 */

/** Below this we treat the delta as browser chrome collapsing, not a keyboard. */
const KEYBOARD_THRESHOLD_PX = 120;

export function useKeyboardInset(active: boolean = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const update = () => {
      // `offsetTop` matters when the page is scrolled within the visual
      // viewport; without it the inset is over-reported while scrolling.
      const covered =
        window.innerHeight - viewport.height - viewport.offsetTop;
      const next = covered > KEYBOARD_THRESHOLD_PX ? Math.round(covered) : 0;

      setInset((current) => (current === next ? current : next));
      root.style.setProperty('--keyboard-inset', `${next}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, [active]);

  return inset;
}

/**
 * Keeps the focused field visible when the keyboard opens over it.
 *
 * Browsers do try to do this themselves, but inside a `position: fixed`
 * overlay whose own height never changed they routinely get it wrong — the
 * scroll happens against the page, not against the modal's scroll container,
 * so nothing moves. Scrolling the element into the centre of its own scroller
 * on focus is reliable regardless.
 */
export function useScrollFocusedFieldIntoView(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      // Wait for the keyboard animation to settle, otherwise we scroll against
      // the pre-keyboard geometry and land in the wrong place.
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 250);
    };

    container.addEventListener('focusin', onFocusIn);
    return () => container.removeEventListener('focusin', onFocusIn);
  }, [active, containerRef]);
}
