/**
 * Public brand identity helpers for catalog headers (owner + visitor parity).
 * Visitors must see brand full name, @username, location, and tags — never
 * blank identity fields when the backend/public profile has usable data.
 */

export type BrandPublicIdentitySource = {
  brandFullName?: string | null;
  username?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  tags?: string[] | null;
  hashtags?: string[] | null;
  publicProfileUrl?: string | null;
  qrTargetUrl?: string | null;
  shareUrl?: string | null;
  description?: string | null;
};

const trim = (value?: string | null): string =>
  typeof value === 'string' ? value.trim() : '';

/** Extract `/u/:username` handle from absolute or relative public brand URLs. */
export function extractUsernameFromProfileUrl(
  url?: string | null,
): string | null {
  const raw = trim(url);
  if (!raw) return null;

  try {
    const path = raw.includes('://')
      ? new URL(raw).pathname
      : raw.startsWith('/')
        ? raw
        : `/${raw}`;
    const match = path.match(/\/u\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1]).replace(/^@+/, '').trim() || null;
  } catch {
    const match = raw.match(/\/u\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]).replace(/^@+/, '').trim() || null;
    } catch {
      return match[1].replace(/^@+/, '').trim() || null;
    }
  }
}

export function resolveBrandUsername(
  source: BrandPublicIdentitySource | null | undefined,
): string {
  if (!source) return '';
  const direct = trim(source.username).replace(/^@+/, '');
  if (direct) return direct;

  return (
    extractUsernameFromProfileUrl(source.publicProfileUrl) ||
    extractUsernameFromProfileUrl(source.shareUrl) ||
    extractUsernameFromProfileUrl(source.qrTargetUrl) ||
    ''
  );
}

export function resolveBrandDisplayName(
  source: BrandPublicIdentitySource | null | undefined,
  fallback = 'Brand',
): string {
  if (!source) return fallback;
  const fullName = trim(source.brandFullName);
  if (fullName) return fullName;
  const username = resolveBrandUsername(source);
  if (username) return username;
  return fallback;
}

export function resolveBrandLocation(
  source: BrandPublicIdentitySource | null | undefined,
): string {
  if (!source) return '';
  const direct = trim(source.location);
  if (direct) return direct;

  return [source.city, source.state, source.country]
    .map((part) => trim(part))
    .filter(Boolean)
    .join(', ');
}

export function resolveBrandTags(
  source: BrandPublicIdentitySource | null | undefined,
): string[] {
  if (!source) return [];
  const raw = Array.isArray(source.tags) && source.tags.length > 0
    ? source.tags
    : Array.isArray(source.hashtags)
      ? source.hashtags
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    const tag = String(entry ?? '')
      .trim()
      .replace(/^#+/, '');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function resolvePublicBrandIdentity(
  source: BrandPublicIdentitySource | null | undefined,
): {
  brandName: string;
  username: string;
  location: string;
  tags: string[];
  description: string;
} {
  return {
    brandName: resolveBrandDisplayName(source),
    username: resolveBrandUsername(source),
    location: resolveBrandLocation(source),
    tags: resolveBrandTags(source),
    description: trim(source?.description),
  };
}
