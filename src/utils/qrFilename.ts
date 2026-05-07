const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]+/g;
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
    .split('')
    .filter((character) => character.charCodeAt(0) > 31)
    .join('')
    .replace(WHITESPACE, '-')
    .replace(SEPARATOR, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  const resolved = base || fallback;
  return resolved.endsWith('.png') ? resolved : `${resolved}.png`;
};
