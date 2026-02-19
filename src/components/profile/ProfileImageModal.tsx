import React from 'react';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ProfileImageModalProps {
  open: boolean;
  src?: string | null;
  alt?: string;
  onClose: () => void;
}

const ProfileImageModal: React.FC<ProfileImageModalProps> = ({ open, src, alt = 'Profile image', onClose }) => {
  const isVisible = Boolean(open && src);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: isVisible,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  React.useEffect(() => {
    if (!isVisible) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isVisible]);

  if (!open || !src) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center px-4 py-6" onClick={onClose}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            tabIndex={-1}
            className="relative w-full max-w-3xl max-h-[90vh] neu-modal-surface overflow-hidden rounded-3xl shadow-2xl outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-initial-focus="true"
              className="absolute top-3 right-3 z-10 rounded-full bg-white/90 px-3 py-2 text-gray-900 shadow-lg transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-gray-900/80 dark:text-gray-100"
              onClick={onClose}
              aria-label="Close image preview"
            >
              ✖️
            </button>

            <figure className="relative h-full w-full">
              <div className="h-full w-full overflow-auto">
                <MediaRenderer
                  kind="image"
                  src={src}
                  alt={alt}
                  maxHeightClassName="max-h-[90vh]"
                  className="rounded-3xl"
                  mediaClassName="rounded-3xl"
                />
              </div>
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-center text-sm font-medium text-white">
                {alt}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ProfileImageModal;
