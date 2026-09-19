'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Generate `legalDocuments.ts` from the user-facing markdown.
 *
 * This script runs in TWO layouts:
 *   1. Local workspace: `threadly/fthreadly` with sibling `threadly/docs/legal/`
 *   2. Isolated clone (Cloudflare Pages / GitHub Actions): the frontend repo
 *      IS the checkout root. There is no parent `docs/` and no `fthreadly/`
 *      wrapper. Looking at `path.resolve('..')/docs/...` is what crashed
 *      Pages with ENOENT `/opt/buildhome/docs/legal/user-facing/...`.
 *
 * Resolution order:
 *   1. Workspace sibling `../docs/legal/user-facing` (local edits)
 *   2. In-repo `docs/legal/user-facing` (what CI actually has)
 *   3. If neither exists, keep the committed generated file and exit 0
 *      so `npm run build` still deploys.
 */
const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');

const SOURCE_CANDIDATES = [
  path.join(workspaceRoot, 'docs', 'legal', 'user-facing'),
  path.join(frontendRoot, 'docs', 'legal', 'user-facing'),
];

const FILES = [
  ['TERMS_OF_SERVICE', 'terms', 'Terms and Conditions', '01_TERMS_AND_CONDITIONS.md', 'Operating terms for WIEZ visitors, buyers, creators, brand owners, brand staff, marketplace content, checkout, and protected account actions.'],
  ['PRIVACY_POLICY', 'privacy', 'Privacy Policy', '02_PRIVACY_POLICY.md', 'How WIEZ collects, uses, discloses, protects, retains, and pseudonymizes account, marketplace, commerce, body measurement, and device data.'],
  ['COOKIE_POLICY', 'cookies', 'Cookie and Tracking Policy', '03_COOKIE_AND_TRACKING_POLICY.md', 'How WIEZ uses cookies, local storage, mobile SecureStore keychains, and first-party telemetry across web and mobile surfaces.'],
  ['COMMUNITY_GUIDELINES', 'community-guidelines', 'Community Guidelines', '04_COMMUNITY_GUIDELINES.md', 'Trust, safety, behavioral standards, and marketplace integrity rules for profiles, stores, designs, reviews, and messaging.'],
  ['SELLER_TERMS', 'seller-terms', 'Seller and Brand Terms', '05_SELLER_BRAND_TERMS.md', 'Commercial terms, 5-point KYC verification, commission schedules, milestone settlements, and fulfillment SLAs for fashion brands and designers.'],
  ['BUYER_POLICY', 'buyer-policy', 'Buyer Marketplace Policy', '06_BUYER_MARKETPLACE_POLICY.md', 'Buyer protections, escrow settlement safety, 72-hour inspection window, bespoke ±0.75-inch fit guarantee, returns, and dispute workflows.'],
  ['PAYMENT_POLICY', 'payment-policy', 'Payment, Billing, and Subscription Policy', '07_PAYMENT_BILLING_SUBSCRIPTION_POLICY.md', 'PCI-DSS Level 1 tokenized payments, multi-currency exchange snapshots, dual-track escrow mechanics, payouts, and chargeback rules.'],
  ['COPYRIGHT_POLICY', 'copyright', 'Content, IP, and Copyright Policy', '08_CONTENT_IP_COPYRIGHT_POLICY.md', 'Creator IP ownership, Nigerian Copyright Act 2022 / DMCA notice-and-takedown procedures, 3-strike repeat infringer system, and counterfeit zero tolerance.'],
  ['ACCOUNT_DELETION_POLICY', 'account-deletion', 'Account and Data Deletion Policy', '09_ACCOUNT_DATA_DELETION_POLICY.md', 'Self-service account closure, soft deactivation, cryptographic pseudonymization, and statutory financial retention schedules.'],
];

const ver = '2026.08.22-v1.0';
const eff = 'August 22, 2026';

const frontendOut = path.join(frontendRoot, 'src', 'pages', 'legal', 'legalDocuments.ts');
const mobileOut = path.join(workspaceRoot, 'threadly-mobile', 'src', 'legal', 'legalDocuments.ts');

function resolveDocsDir() {
  return SOURCE_CANDIDATES.find((dir) =>
    fs.existsSync(path.join(dir, '01_TERMS_AND_CONDITIONS.md')),
  ) || null;
}

function generatedFileIsUsable(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  return text.includes('export const LEGAL_PAGES') && text.includes('content:');
}

function build(importPath, docsDir) {
  const pages = FILES.map(([key, slug, title, fileName, summary]) => {
    const sourcePath = path.join(docsDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing legal source: ${sourcePath}`);
    }
    return {
      key,
      slug,
      title,
      effectiveDate: eff,
      version: ver,
      sourceDocument: 'docs/legal/user-facing/' + fileName,
      summary,
      content: fs.readFileSync(sourcePath, 'utf8'),
    };
  });

  return (
    '// AUTO-GENERATED - DO NOT EDIT DIRECTLY\n' +
    "import type { LegalDocumentKey } from '" + importPath + "';\n\n" +
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
    'export const LEGAL_PAGES: LegalPageDefinition[] = ' + JSON.stringify(pages, null, 2) + ';\n\n' +
    'export const LEGAL_PAGE_BY_SLUG = new Map(\n' +
    '  LEGAL_PAGES.map((doc) => [doc.slug, doc]),\n' +
    ');\n'
  );
}

function writeIfDirExists(outPath, contents) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    return false;
  }
  fs.writeFileSync(outPath, contents, 'utf8');
  return true;
}

const docsDir = resolveDocsDir();

if (!docsDir) {
  if (generatedFileIsUsable(frontendOut)) {
    console.log(
      'SYNC_LEGAL_SKIPPED: markdown sources are not in this clone; using committed src/pages/legal/legalDocuments.ts',
    );
    process.exit(0);
  }
  console.error(
    'SYNC_LEGAL_FAILED: could not find docs/legal/user-facing/*.md next to the workspace or inside this repo, and no generated legalDocuments.ts is present.',
  );
  process.exit(1);
}

const frontendContents = build('@/api/LegalApi', docsDir);
if (!writeIfDirExists(frontendOut, frontendContents)) {
  console.error('SYNC_LEGAL_FAILED: frontend legal output directory does not exist:', path.dirname(frontendOut));
  process.exit(1);
}

const mobileContents = build('@/src/api/LegalApi', docsDir);
const wroteMobile = writeIfDirExists(mobileOut, mobileContents);

console.log('SYNC_LEGAL_SUCCESS');
console.log('  sources:', docsDir);
console.log('  frontend:', frontendOut);
console.log('  mobile:', wroteMobile ? mobileOut : '(skipped — sibling repo not in this clone)');
