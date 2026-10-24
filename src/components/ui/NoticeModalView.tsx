import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { dismissNotice, type NoticePayload, type NoticeTone } from './NoticeModal';

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
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/25 transition-all hover:bg-fuchsia-700 active:scale-[0.98] active:translate-y-[1px] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#15111a]';

const SECONDARY_BUTTON =
  'neu-pressed-button inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:text-slate-200 dark:hover:text-white dark:focus-visible:ring-offset-[#15111a]';


export default function NoticeModalView({ notice, primaryRef, secondaryRef }: {
  notice: (NoticePayload & { id: number }) | null;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  secondaryRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const reduceMotion = useReducedMotion();
  React.useEffect(() => {
    if (!notice) return;
    const frame = requestAnimationFrame(() => primaryRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [notice, primaryRef]);
  const noticeId = notice?.id ?? null;
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
