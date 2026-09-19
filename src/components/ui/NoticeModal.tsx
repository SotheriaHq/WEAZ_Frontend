import React from 'react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

/**
 * Blocking notice modal.
 *
 * Some refusals are consequential enough that the user MUST read them — "this
 * brand isn't verified so you can't order yet" is the motivating case. A toast
 * auto-dismisses in a few seconds, which is faster than many people read, so the
 * explanation was being lost and the disabled button looked simply broken.
 *
 * This renders a small dialog the user has to dismiss. Imperative on purpose:
 * call sites already had `toast.error(...)` in deep async branches, so the swap
 * is one identifier and no plumbing.
 */

export type NoticeTone = 'blocked' | 'info' | 'success';

export type NoticePayload = {
  title?: string;
  message: string;
  tone?: NoticeTone;
  /** Optional secondary action, e.g. "View store". */
  action?: { label: string; onSelect: () => void };
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

const TONE_GLYPH: Record<NoticeTone, string> = {
  blocked: '🚫',
  info: 'ℹ️',
  // Milestones the user should actually register — publishing a store is the
  // motivating case. A toast for that scrolls away before it is read, and the
  // 'blocked'/'info' glyphs both read as a warning on a success.
  success: '🎉',
};

const TONE_TITLE: Record<NoticeTone, string> = {
  blocked: 'Not available yet',
  info: 'Heads up',
  success: 'All done',
};

/** Mount once, near the app root. */
export const NoticeModalHost: React.FC = () => {
  const notice = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  // Only the identity of the showing notice matters here; keying the effect to
  // the whole object would re-run it on every unrelated store emit.
  const noticeId = notice?.id ?? null;

  React.useEffect(() => {
    if (noticeId === null) return;
    // Focus the dismiss button so Enter/Space closes it and screen readers land
    // on the way out rather than on the body text.
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismissNotice();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [noticeId]);

  if (!notice) return null;

  const tone: NoticeTone = notice.tone ?? 'blocked';

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        onClick={dismissNotice}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wiez-notice-title"
          aria-describedby="wiez-notice-body"
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#15111a]"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-2xl leading-none">
              {TONE_GLYPH[tone]}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="wiez-notice-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                {notice.title ?? TONE_TITLE[tone]}
              </h2>
              <p
                id="wiez-notice-body"
                className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {notice.message}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {notice.action ? (
              <button
                type="button"
                onClick={() => {
                  const run = notice.action?.onSelect;
                  dismissNotice();
                  run?.();
                }}
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo-600 transition hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                {notice.action.label}
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={dismissNotice}
              className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default NoticeModalHost;
