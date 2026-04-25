import { sanitizeQrFilename } from './qrFilename';

const triggerDownload = (href: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = sanitizeQrFilename(fileName);
  link.click();
};

export const downloadQrPng = (
  root: HTMLElement | null,
  fileName: string,
): boolean => {
  if (!root) return false;

  const canvas = root.querySelector('canvas');
  if (!canvas) return false;

  try {
    triggerDownload(canvas.toDataURL('image/png'), fileName);
    return true;
  } catch {
    return false;
  }
};
