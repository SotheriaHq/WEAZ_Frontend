import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(opts: {
  active: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  initialFocusSelector?: string;
  restoreFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const { active, containerRef, onEscape, initialFocusSelector, restoreFocusTo } = opts;

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusInitial = () => {
      if (!container) return;
      const bySelector = initialFocusSelector
        ? (container.querySelector(initialFocusSelector) as HTMLElement | null)
        : null;
      const first = bySelector ?? (container.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null);
      (first ?? container).focus?.();
    };

    // Focus after paint so portal content is present.
    queueMicrotask(focusInitial);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => !(el as HTMLElement).hasAttribute('disabled')) as HTMLElement[];

      if (focusables.length === 0) {
        e.preventDefault();
        (containerRef.current as HTMLElement).focus?.();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!current || current === first || !containerRef.current.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!current || current === last || !containerRef.current.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const restoreTarget = restoreFocusTo?.current ?? previouslyFocused;
      restoreTarget?.focus?.();
    };
  }, [active, containerRef, onEscape, initialFocusSelector, restoreFocusTo]);
}
