import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

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

/**
 * Per tone: the glyph, the fallback title, and the tint of the plate the glyph
 * sits on. The plate carries the tone so the title does not have to shout it —
 * one tinted tile reads faster than a coloured border around the whole dialog.
 */
const TONE_STYLE: Record<NoticeTone, { glyph: string; title: string; plate: string }> = {
  blocked: {
    glyph: '🚫',
    title: 'Not available yet',
    plate: 'bg-rose-500/10 ring-rose-500/20',
  },
  info: {
    glyph: 'ℹ️',
    title: 'Heads up',
    plate: 'bg-sky-500/10 ring-sky-500/20',
  },
  // Milestones the user should actually register — publishing a store is the
  // motivating case. A toast for that scrolls away before it is read.
  success: {
    glyph: '🎉',
    title: 'All done',
    plate: 'bg-emerald-500/10 ring-emerald-500/20',
  },
  // Something is in the person's way AND they can clear it themselves. Not a
  // refusal (🚫 reads as "no") and not a warning (⚠️ reads as "broken"): a
  // pointer at the next step.
  action: {
    glyph: '👉',
    title: 'Action needed',
    plate: 'bg-fuchsia-500/10 ring-fuchsia-500/20',
  },
};

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/25 transition-colors hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#15111a]';

const SECONDARY_BUTTON =
  'inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/25 dark:hover:text-white dark:focus-visible:ring-offset-[#15111a]';

/** Mount once, near the app root. */
export const NoticeModalHost: React.FC = () => {
  const notice = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const reduceMotion = useReducedMotion();
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

    // After the entrance frame, or the focus ring draws mid-animation.
    const frame = window.requestAnimationFrame(() => primaryRef.current?.focus());

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
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      // The action may have navigated away, taking the trigger with it.
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus({ preventScroll: true });
      }
    };
  }, [noticeId]);

  const tone: NoticeTone = notice?.tone ?? 'blocked';
  const style = TONE_STYLE[tone];
  const hasAction = Boolean(notice?.action);
  const dismissLabel = notice?.dismissLabel ?? (hasAction ? 'Not now' : 'Got it');
  const titleId = `wiez-notice-title-${noticeId ?? 0}`;
  const bodyId = `wiez-notice-body-${noticeId ?? 0}`;

  return (
    <OverlayPortal>
      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice.id}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onClick={dismissNotice}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              onClick={(event) => event.stopPropagation()}
              /*
                A short rise into place. It marks the dialog as a new layer —
                something that arrived because of what the person just did —
                rather than a panel that was always there. Opacity only under
                reduced motion.
              */
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[26rem] overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#15111a]"
            >
              <div className="flex items-start gap-4 p-6">
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ring-1 ${style.plate}`}
                >
                  {notice.emoji ?? style.glyph}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-slate-900 dark:text-white"
                  >
                    {notice.title ?? style.title}
                  </h2>
                  <div id={bodyId}>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {notice.message}
                    </p>
                    {notice.detail ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {notice.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/*
                Actions on their own band, so they read as the answer to the
                text above rather than more of it. Stacked on a phone with the
                primary on top — where a thumb lands first — side by side from
                `sm`, primary on the right.
              */}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-white/5 dark:bg-white/[0.02] sm:flex-row sm:justify-end">
                {hasAction ? (
                  <button
                    ref={secondaryRef}
                    type="button"
                    onClick={dismissNotice}
                    className={SECONDARY_BUTTON}
                  >
                    {dismissLabel}
                  </button>
                ) : null}
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={() => {
                    const run = notice.action?.onSelect;
                    dismissNotice();
                    run?.();
                  }}
                  className={PRIMARY_BUTTON}
                >
                  {hasAction ? notice.action?.label : dismissLabel}
                  {hasAction ? (
                    <span aria-hidden="true" className="opacity-80">
                      →
                    </span>
                  ) : null}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default NoticeModalHost;
