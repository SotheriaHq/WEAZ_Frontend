import React from 'react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import MediaRenderer from '@/components/media/MediaRenderer';
import type { VerificationDocumentItem } from '@/types/verification';

/**
 * Full-screen evidence viewer for brand-verification review.
 *
 * The inline preview on the review page is boxed inside its grid column, so a
 * NIN slip or ID scan rendered a few hundred pixels wide — too small to check a
 * name or a date against the typed form values, which is the entire job. This
 * gives the reviewer two things the boxed preview cannot:
 *
 *  - "All" — every document at once in a contact-sheet grid, so a reviewer can
 *    cross-check the selfie against the ID against the CAC certificate without
 *    clicking back and forth and losing their place.
 *  - single view — one document filling the viewport.
 *
 * PDFs (the signed letter) stay in an iframe; images render through
 * MediaRenderer so they follow the house image rules.
 */

const isPdf = (document: VerificationDocumentItem) =>
  Boolean(
    document.mimeType?.toLowerCase().includes('pdf') ||
      document.signedUrl?.toLowerCase().includes('.pdf'),
  );

type Props = {
  open: boolean;
  documents: VerificationDocumentItem[];
  /** Document selected on the page; the viewer opens on it. */
  initialKey?: string;
  onClose: () => void;
};

const VerificationEvidenceViewer: React.FC<Props> = ({
  open,
  documents,
  initialKey,
  onClose,
}) => {
  const viewable = React.useMemo(
    () => documents.filter((document) => Boolean(document.signedUrl)),
    [documents],
  );
  // `null` means the contact sheet; a key means that single document.
  const [activeKey, setActiveKey] = React.useState<string | null>(initialKey ?? null);

  React.useEffect(() => {
    if (!open) return;
    setActiveKey(initialKey ?? null);
  }, [initialKey, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        // Escape steps back to the grid first so it never feels like a trap.
        setActiveKey((current) => {
          if (current === null) {
            onClose();
            return null;
          }
          return null;
        });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, open]);

  if (!open) return null;

  const active = activeKey
    ? (viewable.find((document) => document.key === activeKey) ?? null)
    : null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[9999] flex flex-col bg-black/90 backdrop-blur-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={() => setActiveKey(null)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
              >
                ← All evidence
              </button>
            ) : null}
            <p className="truncate text-sm font-semibold">
              {active ? active.label : `All evidence (${viewable.length})`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active?.signedUrl ? (
              <a
                href={active.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
              >
                Open original
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close evidence viewer"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
            >
              Close ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-wiez p-4">
          {viewable.length === 0 ? (
            <p className="mt-16 text-center text-sm text-white/70">
              No evidence files could be loaded for this attempt.
            </p>
          ) : active ? (
            <div className="flex min-h-full items-center justify-center">
              {isPdf(active) ? (
                <iframe
                  title={active.label}
                  src={active.signedUrl ?? ''}
                  className="h-[85vh] w-full max-w-4xl rounded-xl bg-white"
                />
              ) : (
                <MediaRenderer
                  kind="image"
                  src={active.signedUrl ?? ''}
                  alt={active.label}
                  className="block"
                  maxHeightClassName="max-h-[85vh]"
                />
              )}
            </div>
          ) : (
            <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {viewable.map((document) => (
                <button
                  key={document.key}
                  type="button"
                  onClick={() => setActiveKey(document.key)}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-white/5 text-left transition hover:bg-white/10"
                >
                  <span className="flex h-64 items-center justify-center overflow-hidden bg-black/30 p-2">
                    {isPdf(document) ? (
                      <iframe
                        title={document.label}
                        src={document.signedUrl ?? ''}
                        // Non-interactive in the grid: the tile is the button.
                        className="pointer-events-none h-full w-full rounded-lg bg-white"
                      />
                    ) : (
                      <MediaRenderer
                        kind="image"
                        src={document.signedUrl ?? ''}
                        alt={document.label}
                        className="block"
                        maxHeightClassName="max-h-60"
                      />
                    )}
                  </span>
                  <span className="flex items-baseline justify-between gap-2 px-3 py-2.5 text-white">
                    <span className="truncate text-xs font-semibold">{document.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-white/50 group-hover:text-white/80">
                      Enlarge
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
};

export default VerificationEvidenceViewer;
