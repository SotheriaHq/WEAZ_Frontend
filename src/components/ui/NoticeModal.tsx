import React from 'react';
import { DeferredOverlay } from './DeferredOverlay';
const NoticeModalView = React.lazy(() => import('./NoticeModalView'));

/**
 * Blocking notice modal.
 *
 * Some refusals are consequential enough that the user MUST read them — "this
 * brand isn't verified so you can't order yet" is the motivating case. A toast
 * auto-dismisses in a few seconds, which is faster than many people read, so the
 * explanation was being lost and the disabled button looked simply broken.
 *
 * Imperative on purpose: call sites already had `toast.error(...)` in deep async
 * branches, so the swap is one identifier and no plumbing.
 *
 * ## The next step is the primary button
 *
 * When a notice carries an action, that action is the whole point of the notice
 * — "Verify bank account", "Open verification", "Go to: Store details". It used
 * to render as a ghost text link beside a solid black "Got it" that also held
 * focus, so the loudest control, and the one Enter pressed, was the way OUT. A
 * person who did not read closely dismissed the notice and was back where they
 * started, which is exactly the failure the modal was introduced to fix.
 *
 * Now: with an action, the action is the solid primary, it takes focus, and the
 * dismissal is a quiet "Not now". Without one, "Got it" is the only button and
 * is primary. The trailing arrow says the primary takes you somewhere.
 */

export type NoticeTone = 'blocked' | 'info' | 'success' | 'action';

export type NoticePayload = {
  title?: string;
  message: string;
  tone?: NoticeTone;
  /** Replaces the tone's glyph when the subject has a better one — 🏦 for a bank account. */
  emoji?: string;
  /**
   * A quieter second line: reassurance, or what happens after the action.
   * "Your balance stays where it is" answers the question someone is actually
   * asking when a payout is refused, which the message itself does not.
   */
  detail?: string;
  /** The thing to do next. Rendered as THE primary button. */
  action?: { label: string; onSelect: () => void };
  /** Closing without acting. Defaults to "Not now" beside an action, "Got it" alone. */
  dismissLabel?: string;
};

type NoticeState = (NoticePayload & { id: number }) | null;

let current: NoticeState = null;
const listeners = new Set<() => void>();
let nextId = 1;

const emit = () => listeners.forEach((listener) => listener());

/** Show a notice the user must dismiss. Replaces any notice already showing. */
export function showNotice(payload: NoticePayload | string): void {
  const next = typeof payload === 'string' ? { message: payload } : payload;
  if (!next.message?.trim()) return;
  current = { ...next, id: nextId++ };
  emit();
}

export function dismissNotice(): void {
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => current;

/** Mount once, near the app root. */
export const NoticeModalHost: React.FC = () => {
  const notice = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const primaryRef = React.useRef<HTMLButtonElement | null>(null);
  const secondaryRef = React.useRef<HTMLButtonElement | null>(null);
  // Only the identity of the showing notice matters here; keying the effect to
  // the whole object would re-run it on every unrelated store emit.
  const noticeId = notice?.id ?? null;

  React.useEffect(() => {
    if (noticeId === null) return;

    // Where focus goes back to when this closes — "Not now" returns the person
    // to the button that raised the notice instead of dropping them at <body>.
    const restoreTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;


    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismissNotice();
        return;
      }
      /*
        Keep Tab inside the dialog. It is an alertdialog over an inert page;
        tabbing out of it lands on controls the backdrop is covering, which is
        disorienting for keyboard users and invisible to everyone else.
      */
      if (event.key === 'Tab') {
        const nodes = [secondaryRef.current, primaryRef.current].filter(
          (node): node is HTMLButtonElement => Boolean(node),
        );
        if (nodes.length === 0) return;
        event.preventDefault();
        const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.shiftKey
          ? index <= 0
            ? nodes.length - 1
            : index - 1
          : (index + 1) % nodes.length;
        nodes[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // The action may have navigated away, taking the trigger with it.
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus({ preventScroll: true });
      }
    };
  }, [noticeId]);

  return <DeferredOverlay open={Boolean(notice)}>
    <NoticeModalView notice={notice} primaryRef={primaryRef} secondaryRef={secondaryRef} />
  </DeferredOverlay>;
};

export default NoticeModalHost;
