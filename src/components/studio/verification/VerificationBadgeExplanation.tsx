import { useCallback, useEffect, useRef, useState } from 'react';
import VerificationBadgeMeaningContent from './VerificationBadgeMeaningContent';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

interface VerificationBadgeExplanationProps {
  triggerClassName?: string;
}

export default function VerificationBadgeExplanation({
  triggerClassName = '',
}: VerificationBadgeExplanationProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const queueClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 140);
  }, [clearCloseTimer]);

  const openPanel = useCallback(() => {
    clearCloseTimer();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.min(340, Math.max(220, window.innerWidth - 24));
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12));
    setPosition({ top: rect.bottom + 10, left });
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;

    const onReposition = () => openPanel();
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    document.addEventListener('mousedown', onOutside);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open, openPanel]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={openPanel}
        onMouseLeave={queueClose}
        onFocus={openPanel}
        onBlur={queueClose}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 ${triggerClassName}`}
        aria-expanded={open}
        aria-label="Open badge meaning"
      >
        ✅ Badge?
      </button>

      {open ? (
        <OverlayPortal>
          <div
            ref={panelRef}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={queueClose}
            className="fixed w-[min(340px,calc(100vw-1.5rem))] max-h-[320px] overflow-y-auto rounded-2xl border border-sky-100 bg-white p-3 shadow-2xl"
            style={{ top: position.top, left: position.left, zIndex: 1200 }}
            role="dialog"
            aria-label="Verification Badge Meaning"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              Verification Badge Meaning
            </p>
            <VerificationBadgeMeaningContent compact />
          </div>
        </OverlayPortal>
      ) : null}

    </>
  );
}
