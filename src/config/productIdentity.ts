export const APP_NAME = 'WIEZ';
export const COMPANY_NAME = APP_NAME;
export const FORMER_PRODUCT_NAME = 'Threadly';
export const PRODUCT_TAGLINE = 'When you think WEARS, you think WIEZ.';
export const PRODUCT_LOGO_TAGLINE = 'JUST WEAR';
export const PRODUCT_DESCRIPTION =
  'African fashion social commerce marketplace';
export const PUBLIC_WEB_URL =
  import.meta.env.VITE_APP_URL || '[PRODUCT CONFIRMATION NEEDED]';
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || '[PRODUCT CONFIRMATION NEEDED]';
export const LEGAL_EMAIL =
  import.meta.env.VITE_LEGAL_EMAIL || '[PRODUCT CONFIRMATION NEEDED]';
export const COPYRIGHT_OWNER = '[PRODUCT CONFIRMATION NEEDED]';

export const COMPANY_LOGO_PATH = '/brand/wiez-logo-mark.svg';
export const COMPANY_LOGO_LOCKUP_PATH = '/brand/wiez-logo-lockup.svg';
export const COMPANY_WORDMARK_PATH = '/brand/wiez-wordmark.svg';
export const COMPANY_FAVICON_PATH = '/brand/wiez-favicon.svg';
export const LOGO_ACCESSIBILITY_LABEL = `${APP_NAME} logo`;

export const BRAND_PALETTE = {
  deepNavy: '#16233f',
  softNavy: '#4b5670',
  metallicGold: '#d8b24a',
  highlightGold: '#fff1a8',
  burnishedGold: '#9f6419',
} as const;

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
