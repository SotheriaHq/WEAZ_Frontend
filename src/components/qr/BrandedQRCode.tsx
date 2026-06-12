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
  /** Username to embed visually below the QR code */
  username?: string | null;
  onLogoMessage?: (message: string | null) => void;
}

/** WEAZ brand gradient — purple to indigo */
const THREADLY_FG_COLOR = '#6d28d9'; // purple-700
const THREADLY_EYE_COLOR = '#4f46e5'; // indigo-600

export const BrandedQRCode = forwardRef<HTMLDivElement, BrandedQRCodeProps>(
  (
    {
      value,
      logo,
      previewSize = 236,
      exportSize = 960,
      className,
      username,
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
    }, [logo, onLogoMessage]);

    const darkMode = theme === 'dark';
    const fgColor = darkMode ? '#c4b5fd' : THREADLY_FG_COLOR; // purple-300 in dark, purple-700 in light
    const bgColor = darkMode ? '#18181b' : '#ffffff'; // zinc-900 in dark

    return (
      <div
        ref={ref}
        className={className}
        data-theme={theme}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <QRCode
          value={value}
          size={exportSize}
          ecLevel={logoUrl || username ? 'Q' : 'M'}
          quietZone={12}
          qrStyle="dots"
          bgColor={bgColor}
          fgColor={fgColor}
          eyeColor={darkMode ? '#a78bfa' : THREADLY_EYE_COLOR}
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
        {/* Username embedded inside the QR code — bottom edge */}
        {username ? (
          <div
            style={{
              position: 'absolute',
              bottom: Math.round(previewSize * 0.06),
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                fontSize: Math.max(9, Math.round(previewSize * 0.042)),
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.03em',
                color: fgColor,
                backgroundColor: bgColor,
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              @{username}
            </span>
          </div>
        ) : null}
      </div>
    );
  },
);

BrandedQRCode.displayName = 'BrandedQRCode';

export default BrandedQRCode;
