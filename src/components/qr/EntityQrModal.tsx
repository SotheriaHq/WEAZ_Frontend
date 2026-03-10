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

        <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white/95 p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-950/95 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Share
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200/80 bg-white text-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5">
            <QRExportFrame title={title} subtitle={subtitle} note={logoMessage}>
              <BrandedQRCode
                ref={qrRootRef}
                value={url}
                logo={{ url: logoUrl, fileId: logoFileId }}
                previewSize={236}
                exportSize={960}
                onLogoMessage={setLogoMessage}
              />
            </QRExportFrame>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              Public link
            </p>
            <p className="mt-1 break-all text-xs font-medium text-gray-800 dark:text-gray-200">
              {url}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <span aria-hidden="true">🔗</span>
              Copy Link
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <span aria-hidden="true">↗️</span>
              Share
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              <span aria-hidden="true">⬇️</span>
              Download
            </button>
          </div>
        </section>
      </div>
    </OverlayPortal>
  );
};

export default EntityQrModal;
