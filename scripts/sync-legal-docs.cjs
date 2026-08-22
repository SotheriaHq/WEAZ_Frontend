const fs = require('fs');
const path = require('path');

const root = path.resolve('..');
const docs = path.join(root, 'docs', 'legal', 'user-facing');
const files = [
  ['TERMS_OF_SERVICE', 'terms', 'Terms and Conditions', '01_TERMS_AND_CONDITIONS.md', 'Operating terms for WEEZ visitors, buyers, creators, brand owners, brand staff, marketplace content, checkout, and protected account actions.'],
  ['PRIVACY_POLICY', 'privacy', 'Privacy Policy', '02_PRIVACY_POLICY.md', 'How WEEZ collects, uses, discloses, protects, retains, and pseudonymizes account, marketplace, commerce, body measurement, and device data.'],
  ['COOKIE_POLICY', 'cookies', 'Cookie and Tracking Policy', '03_COOKIE_AND_TRACKING_POLICY.md', 'How WEEZ uses cookies, local storage, mobile SecureStore keychains, and first-party telemetry across web and mobile surfaces.'],
  ['COMMUNITY_GUIDELINES', 'community-guidelines', 'Community Guidelines', '04_COMMUNITY_GUIDELINES.md', 'Trust, safety, behavioral standards, and marketplace integrity rules for profiles, stores, designs, reviews, and messaging.'],
  ['SELLER_TERMS', 'seller-terms', 'Seller and Brand Terms', '05_SELLER_BRAND_TERMS.md', 'Commercial terms, 5-point KYC verification, commission schedules, milestone settlements, and fulfillment SLAs for fashion brands and designers.'],
  ['BUYER_POLICY', 'buyer-policy', 'Buyer Marketplace Policy', '06_BUYER_MARKETPLACE_POLICY.md', 'Buyer protections, escrow settlement safety, 72-hour inspection window, bespoke °0.75-inch fit guarantee, returns, and dispute workflows.'],
  ['PAYMENT_POLICY', 'payment-policy', 'Payment, Billing, and Subscription Policy', '07_PAYMENT_BILLING_SUBSCRIPTION_POLICY.md', 'PCI-DSS Level 1 tokenized payments, multi-currency exchange snapshots, dual-track escrow mechanics, payouts, and chargeback rules.'],
  ['COPYRIGHT_POLICY', 'copyright', 'Content, IP, and Copyright Policy', '08_CONTENT_IP_COPYRIGHT_POLICY.md', 'Creator IP ownership, Nigerian Copyright Act 2022 / DMCA notice-and-takedown procedures, 3-strike repeat infringer system, and counterfeit zero tolerance.'],
  ['ACCOUNT_DELETION_POLICY', 'account-deletion', 'Account and Data Deletion Policy', '09_ACCOUNT_DATA_DELETION_POLICY.md', 'Self-service account closure, soft deactivation, cryptographic pseudonymization, and statutory financial retention schedules.']
];

const ver = '2026.08.22-v1.0';
const eff = 'August 22, 2026';

function build(imp) {
  const p = files.map(([k, s, t, f, sm]) => ({
    key: k, slug: s, title: t, effectiveDate: eff, version: ver,
    sourceDocument: 'docs/legal/user-facing/' + f, summary: sm,
    content: fs.readFileSync(path.join(docs, f), 'utf8')
  }));
  return '// AUTO-GENERATED - DO NOT EDIT DIRECTLY\n' +
    'import type { LegalDocumentKey } from \'' + imp + '\';\n\n' +
    'export type LegalPageDefinition = {\n' +
    '  key: LegalDocumentKey;\n' +
    '  slug: string;\n' +
    '  title: string;\n' +
    '  effectiveDate: string;\n' +
    '  version: string;\n' +
    '  sourceDocument: string;\n' +
    '  summary: string;\n' +
    '  content: string;\n' +
    '};\n\n' +
    'export const LEGAL_PAGE_VERSION = ' + JSON.stringify(ver) + ';\n' +
    'export const LEGAL_PAGE_EFFECTIVE_DATE = ' + JSON.stringify(eff) + ';\n\n' +
    'export const LEGAL_PAGES: LegalPageDefinition[] = ' + JSON.stringify(p, null, 2) + ';\n\n' +
    'export const LEGAL_PAGE_BY_SLUG = new Map(\n' +
    '  LEGAL_PAGES.map((doc) => [doc.slug, doc]),\n' +
    ');\n';
}

fs.writeFileSync(path.join(root, 'fthreadly', 'src', 'pages', 'legal', 'legalDocuments.ts'), build('@/api/LegalApi'), 'utf8');
fs.writeFileSync(path.join(root, 'threadly-mobile', 'src', 'legal', 'legalDocuments.ts'), build('@/src/api/LegalApi'), 'utf8');
console.log('SYNC_LEGAL_SUCCESS');