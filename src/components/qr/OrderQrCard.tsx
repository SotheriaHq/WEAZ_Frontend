import React, { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import BrandedQRCode from './BrandedQRCode';
import QRExportFrame from './QRExportFrame';
import { buildOrderUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { downloadQrPng } from '@/utils/qrExport';
import { sanitizeQrFilename } from '@/utils/qrFilename';
import type { RootState } from '@/store';

export interface OrderQrCardProps {
  orderId: string;
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
  logoFileId?: string | null;
}

const OrderQrCard: React.FC<OrderQrCardProps> = ({
  orderId,
  title = 'Order QR Code',
  subtitle = 'Scan to reopen this order while signed in.',
  logoUrl,
  logoFileId,
}) => {
  const currentUsername = useSelector(
    (state: RootState) => state.user.profile?.username?.trim() || null,
  );
  const qrRootRef = useRef<HTMLDivElement | null>(null);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const url = useMemo(() => buildOrderUrl(orderId), [orderId]);
  const fileName = useMemo(
    () => sanitizeQrFilename(`order-${orderId}-qr`),
    [orderId],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Order link copied.');
    } catch {
      toast.error('Unable to copy order link.');
    }
  };

  const handleShare = async () => {
    await shareOrCopyLink({
      url,
      title,
      text: subtitle,
      successMessage: 'Order link copied.',
      errorMessage: 'Unable to share this order link.',
    });
  };

  const handleDownload = () => {
    if (!downloadQrPng(qrRootRef.current, fileName)) {
      toast.error('Unable to export this QR code right now.');
    }
  };

  return (
    <section className="rounded-[1.75rem] border border-gray-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="lg:w-[300px]">
          <QRExportFrame title={title} subtitle={subtitle} note={logoMessage}>
            <BrandedQRCode
              ref={qrRootRef}
              value={url}
              logo={currentUsername ? null : { url: logoUrl, fileId: logoFileId }}
              previewSize={228}
              exportSize={960}
              username={currentUsername}
              onLogoMessage={setLogoMessage}
            />
          </QRExportFrame>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              Secure order link
            </p>
            <p className="mt-1 break-all text-xs font-medium text-gray-800 dark:text-gray-200">
              {url}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <span aria-hidden="true">🔗</span>
              Copy link
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
        </div>
      </div>
    </section>
  );
};

export default OrderQrCard;
