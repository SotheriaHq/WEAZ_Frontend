import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import BrandedQRCode from './BrandedQRCode';
import QRExportFrame from './QRExportFrame';
import { shareOrCopyLink } from '@/utils/publicLinks';
import { downloadQrPng } from '@/utils/qrExport';
import { sanitizeQrFilename } from '@/utils/qrFilename';

export interface EntityQrModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  url: string;
  downloadFileName: string;
  logoUrl?: string | null;
  logoFileId?: string | null;
  /** Username to embed visually in the QR code */
  username?: string | null;
}

export const EntityQrModal: React.FC<EntityQrModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  url,
  downloadFileName,
  logoUrl,
  logoFileId,
  username,
}) => {
  const qrRootRef = useRef<HTMLDivElement | null>(null);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const normalizedFileName = useMemo(
    () => sanitizeQrFilename(downloadFileName),
    [downloadFileName],
  );

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  const handleShare = async () => {
    await shareOrCopyLink({
      url,
      title,
      text: subtitle,
      successMessage: 'Link copied.',
      errorMessage: 'Unable to share this link.',
    });
  };

  const handleDownload = () => {
    if (!downloadQrPng(qrRootRef.current, normalizedFileName)) {
      toast.error('Unable to export QR right now.');
    }
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close QR code modal"
        />

        <section className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[2rem] border border-gray-200/70 bg-white/95 p-4 shadow-2xl dark:border-white/10 dark:bg-zinc-950/95 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:h-10 sm:w-10 sm:rounded-2xl"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 sm:mt-5">
            <QRExportFrame note={logoMessage}>
              <BrandedQRCode
                ref={qrRootRef}
                value={url}
                logo={{ url: logoUrl, fileId: logoFileId }}
                username={username}
                previewSize={236}
                exportSize={960}
                onLogoMessage={setLogoMessage}
              />
            </QRExportFrame>
          </div>

          <div className="mt-3 rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/5 sm:mt-4 sm:rounded-2xl sm:py-3">
            <p className="break-all text-[11px] font-medium text-gray-800 dark:text-gray-200 sm:text-xs">
              {url}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-2 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
            >
              <span aria-hidden="true">🔗</span>
              Copy
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-2 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
            >
              <span aria-hidden="true">↗️</span>
              Share
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
            >
              <span aria-hidden="true">⬇️</span>
              Save
            </button>
          </div>
        </section>
      </div>
    </OverlayPortal>
  );
};

export default EntityQrModal;
