const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g;
const WHITESPACE = /\s+/g;
const SEPARATOR = /-+/g;

export const sanitizeQrFilename = (
  value: string | null | undefined,
  fallback = 'threadly-qr',
): string => {
  const base = (value || '')
    .trim()
    .toLowerCase()
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(WHITESPACE, '-')
    .replace(SEPARATOR, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  const resolved = base || fallback;
  return resolved.endsWith('.png') ? resolved : `${resolved}.png`;
};
