import { forwardRef, useEffect, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { useCurrentTheme } from '@/hooks/useCurrentTheme';
import { resolveQrLogo, type QrLogoSource } from '@/utils/qrLogoResolver';

export interface BrandedQRCodeProps {
  value: string;
  logo?: QrLogoSource | null;
  previewSize?: number;
  exportSize?: number;
  className?: string;
  onLogoMessage?: (message: string | null) => void;
}

export const BrandedQRCode = forwardRef<HTMLDivElement, BrandedQRCodeProps>(
  (
    {
      value,
      logo,
      previewSize = 236,
      exportSize = 960,
      className,
      onLogoMessage,
    },
    ref,
  ) => {
    const theme = useCurrentTheme();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    useEffect(() => {
      let active = true;

      const run = async () => {
        const resolved = await resolveQrLogo(logo);
        if (!active) return;
        setLogoUrl(resolved.url);
        onLogoMessage?.(resolved.message ?? null);
      };

      void run();
      return () => {
        active = false;
      };
    }, [logo?.fileId, logo?.url, onLogoMessage]);

    return (
      <div
        ref={ref}
        className={className}
        data-theme={theme}
      >
        <QRCode
          value={value}
          size={exportSize}
          ecLevel={logoUrl ? 'Q' : 'M'}
          quietZone={12}
          qrStyle="dots"
          bgColor="#ffffff"
          fgColor="#111827"
          logoImage={logoUrl || undefined}
          logoWidth={logoUrl ? exportSize * 0.18 : undefined}
          logoHeight={logoUrl ? exportSize * 0.18 : undefined}
          logoPadding={logoUrl ? Math.max(8, Math.round(exportSize * 0.02)) : undefined}
          removeQrCodeBehindLogo={Boolean(logoUrl)}
          style={{
            width: previewSize,
            height: previewSize,
            maxWidth: '100%',
            display: 'block',
          }}
        />
      </div>
    );
  },
);

BrandedQRCode.displayName = 'BrandedQRCode';

export default BrandedQRCode;
