import { forwardRef, useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { useCurrentTheme } from '@/hooks/useCurrentTheme';
import { resolveQrLogo, type QrLogoSource } from '@/utils/qrLogoResolver';
import { drawQrCenterLabel } from '@/utils/qrCenterLabel';

export interface BrandedQRCodeProps {
  value: string;
  logo?: QrLogoSource | null;
  previewSize?: number;
  exportSize?: number;
  className?: string;
  /** Handle to stamp in the middle of the code, rendered as `@name`. */
  username?: string | null;
}

/** WIEZ brand gradient — purple to indigo */
const WIEZ_FG_COLOR = '#6d28d9'; // purple-700
const WIEZ_EYE_COLOR = '#4f46e5'; // indigo-600

export const BrandedQRCode = forwardRef<HTMLDivElement, BrandedQRCodeProps>(
  (
    { value, logo, previewSize = 236, exportSize = 960, className, username },
    ref,
  ) => {
    const theme = useCurrentTheme();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);

    const handle = username?.trim() ? `@${username.trim()}` : null;

    // The handle owns the middle of the code, so a brand logo would land on top
    // of it. Only fetch/paint the logo when there is no handle to show.
    const wantsLogo = !handle && Boolean(logo);

    useEffect(() => {
      if (!wantsLogo) {
        setLogoUrl(null);
        return;
      }

      let active = true;
      void (async () => {
        const resolved = await resolveQrLogo(logo);
        if (active) setLogoUrl(resolved.url);
      })();
      return () => {
        active = false;
      };
    }, [logo, wantsLogo]);

    const darkMode = theme === 'dark';
    const fgColor = darkMode ? '#c4b5fd' : WIEZ_FG_COLOR; // purple-300 in dark, purple-700 in light
    const bgColor = darkMode ? '#18181b' : '#ffffff'; // zinc-900 in dark
    const eyeColor = darkMode ? '#a78bfa' : WIEZ_EYE_COLOR;

    /**
     * The handle is painted INTO the QR canvas, not layered over it as a
     * positioned `<span>`. `downloadQrPng` exports `canvas.toDataURL()`, so an
     * overlay div is visible in the modal and then silently absent from the
     * saved PNG — which is why the handle "was not part of" the QR anyone
     * actually shared. Drawing on the canvas makes the preview and the export
     * the same artwork by construction.
     *
     * `react-qrcode-logo` repaints the canvas from scratch whenever its props
     * change, wiping this; every input that can trigger that repaint is in the
     * dep list so the label is restamped. Child effects run before parent
     * effects, so the code itself is always on the canvas by the time this runs.
     */
    useEffect(() => {
      const canvas = hostRef.current?.querySelector('canvas');
      if (!canvas || !handle) return;
      drawQrCenterLabel(canvas, handle, { fgColor, bgColor });
    }, [handle, value, fgColor, bgColor, eyeColor, exportSize, logoUrl]);

    const setRefs = (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <div
        ref={setRefs}
        className={className}
        data-theme={theme}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <QRCode
          value={value}
          size={exportSize}
          // 'Q' recovers ~25% of the code, which comfortably covers the small
          // centre plate the handle or logo sits on.
          ecLevel={logoUrl || handle ? 'Q' : 'M'}
          quietZone={12}
          qrStyle="dots"
          bgColor={bgColor}
          fgColor={fgColor}
          eyeColor={eyeColor}
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
