/**
 * The single source for WIEZ's name, palette and artwork paths on the web.
 *
 * This replaced two files that both claimed the job — `config/productIdentity`
 * and a `lib/brand` re-export shim in front of it — which between them exported
 * the same string under two names (`APP_NAME` and `COMPANY_NAME`) plus nine
 * constants with zero consumers. Export names now match the mobile and backend
 * identity modules exactly, so a value can be grepped across all three repos.
 *
 * Sibling: `wiezOrbArtwork.ts` holds the mark's geometry. Nothing else in the
 * app may declare a brand name, a brand colour, or a path into /brand.
 */

/** The product name. There is no former name to surface anywhere. */
export const PRODUCT_NAME = 'WIEZ';

export const PRODUCT_TAGLINE = 'When you think WEARS, you think WIEZ.';

export const PRODUCT_CATEGORY = 'African fashion social commerce marketplace';

export const LOGO_ACCESSIBILITY_LABEL = `${PRODUCT_NAME} logo`;

/**
 * The brand palette, as actually painted.
 *
 * What was here before was a navy-and-gold set (`#16233f` / `#d8b24a`) that no
 * component read, while the UI painted purple `#9333EA` from three separate
 * hardcoded copies — the boot splash, the loader and the email shell. These are
 * the violet ramp's anchors, so the palette and the artwork cannot drift.
 *
 * `primary` and `onDark` are a deliberate pair: `primary` clears white at
 * 7.8:1 and `onDark` clears #0c0b11 at 7.1:1. Neither works on the other
 * ground — `primary` sits at 1.9:1 on ink — and that is the whole reason the
 * old logo dissolved on the dark theme. The figures are asserted, not
 * remembered: threadly-mobile/scripts/test-product-identity-contract.js.
 */
export const BRAND_COLORS = {
  /** Primary violet for light grounds — buttons, links, the loader ring. */
  primary: '#6015e2',
  /** Pressed/strong state on light grounds. */
  primaryStrong: '#4e11b8',
  /** Primary violet for dark grounds. Never use `primary` there. */
  onDark: '#af87f4',
  /** Tint for fills and rails, both grounds. */
  soft: '#a97ef3',
  /** The brand ground. The app icon, the og card and the night theme sit on it. */
  ink: '#0c0b11',
} as const;

/**
 * Paths into `public/brand`. Referencing these by literal is how the app ended
 * up shipping two different logos under one filename stem.
 *
 * The mark is theme-paired rather than tinted: it is full-colour artwork, so
 * there is no filter that adapts it. Pick with the resolved theme.
 */
export const BRAND_ASSETS = {
  markLight: '/brand/wiez-mark-light.svg',
  markDark: '/brand/wiez-mark-dark.svg',
  /** For grounds that are not known ahead of time — over imagery, over video. */
  markNeutral: '/brand/wiez-mark.svg',
  favicon: '/brand/wiez-favicon.svg',
  /** Social cards have no theme, so this is a raster on the brand ground. */
  openGraph: '/brand/wiez-og.png',
} as const;

export const PUBLIC_WEB_URL =
  import.meta.env.VITE_APP_URL || '[PRODUCT CONFIRMATION NEEDED]';
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || '[PRODUCT CONFIRMATION NEEDED]';
export const LEGAL_EMAIL =
  import.meta.env.VITE_LEGAL_EMAIL || '[PRODUCT CONFIRMATION NEEDED]';

export const LEGAL_ROUTE_LABELS = {
  legalIndex: 'Legal',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  cookies: 'Cookie and Tracking Policy',
  communityGuidelines: 'Community Guidelines',
  sellerTerms: 'Seller and Brand Terms',
  buyerPolicy: 'Buyer Marketplace Policy',
  paymentPolicy: 'Payment, Billing, and Subscription Policy',
  copyrightPolicy: 'Content, IP, and Copyright Policy',
  accountDeletion: 'Account and Data Deletion Policy',
} as const;
