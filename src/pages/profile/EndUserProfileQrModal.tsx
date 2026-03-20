import React from 'react';
import LazyEntityQrModal from '@/components/qr/LazyEntityQrModal';

interface EndUserProfileQrModalProps {
  open: boolean;
  profileUrl: string;
  logoUrl?: string | null;
  username?: string | null;
  onClose: () => void;
}

export const EndUserProfileQrModal: React.FC<EndUserProfileQrModalProps> = ({
  open,
  profileUrl,
  logoUrl,
  username,
  onClose,
}) => {
  return (
    <LazyEntityQrModal
      open={open}
      onClose={onClose}
      title="Profile QR Code"
      subtitle="Scan to open this profile."
      url={profileUrl}
      downloadFileName="profile-qr.png"
      logoUrl={logoUrl}
      username={username}
    />
  );
};
