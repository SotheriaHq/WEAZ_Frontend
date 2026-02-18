import React, { useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

interface EndUserProfileQrModalProps {
  open: boolean;
  profileUrl: string;
  onClose: () => void;
}

export const EndUserProfileQrModal: React.FC<EndUserProfileQrModalProps> = ({
  open,
  profileUrl,
  onClose,
}) => {
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
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied');
    } catch {
      toast.error('Unable to copy profile link');
    }
  };

  const handleDownload = () => {
    const canvas = document.getElementById('end-user-profile-qr') as HTMLCanvasElement | null;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = data;
    link.download = 'profile-qr.png';
    link.click();
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close profile qr modal"
        />

        <div className="relative z-10 w-full max-w-sm rounded-3xl neu-modal-surface shadow-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[color:var(--neu-text)]">Profile QR Code</h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg neu-modal-inset"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-[color:var(--neu-text-muted)]" />
            </button>
          </div>

          <div className="rounded-2xl neu-modal-inset p-4 grid place-items-center">
            <QRCodeCanvas
              id="end-user-profile-qr"
              value={profileUrl}
              size={220}
              includeMargin
              bgColor="#ffffff"
              fgColor="#111827"
              level="Q"
            />
          </div>

          <p className="mt-3 text-xs neu-text-muted break-all">{profileUrl}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-xl neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};
