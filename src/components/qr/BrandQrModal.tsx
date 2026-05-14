import React from 'react';
import LazyEntityQrModal from './LazyEntityQrModal';

type BrandQrModalProps = {
  open: boolean;
  onClose: () => void;
  brandName: string;
  qrTargetUrl?: string | null;
  shareUrl?: string | null;
  logoUrl?: string | null;
  logoFileId?: string | null;
  username?: string | null;
};

const BrandQrModal: React.FC<BrandQrModalProps> = ({
  open,
  onClose,
  brandName,
  qrTargetUrl,
  shareUrl,
  logoUrl,
  logoFileId,
  username,
}) => {
  const url = qrTargetUrl || shareUrl || '';

  if (!url) return null;

  return (
    <LazyEntityQrModal
      open={open}
      onClose={onClose}
      title={`${brandName || 'Brand'} QR Code`}
      subtitle="Scan to open this public brand profile."
      url={url}
      downloadFileName={`${brandName || 'threadly-brand'}-qr`}
      logoUrl={logoUrl}
      logoFileId={logoFileId}
      username={username}
    />
  );
};

export default BrandQrModal;
