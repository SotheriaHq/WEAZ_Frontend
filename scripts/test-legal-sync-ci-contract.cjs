'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(repoRoot, 'scripts', 'sync-legal-docs.cjs'), 'utf8');
const generated = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'legal', 'legalDocuments.ts'),
  'utf8',
);

assert.match(
  script,
  /frontendRoot = path\.resolve\(__dirname, '\.\.'\)/,
  'Legal sync must root itself at this repo (scripts/..), not process.cwd()/..',
);
assert.doesNotMatch(
  script,
  /path\.join\(root, 'fthreadly'/,
  'Legal sync must not write to ../fthreadly — that path does not exist in a Pages clone.',
);
assert.match(
  script,
  /SYNC_LEGAL_SKIPPED/,
  'When markdown is absent from a frontend-only clone, sync must skip instead of ENOENT.',
);
assert.match(
  script,
  /docs', 'legal', 'user-facing/,
  'Legal sync must look for in-repo docs/legal/user-facing as well as the workspace sibling.',
);
assert.match(
  generated,
  /export const LEGAL_PAGES/,
  'Committed generated legal pages must exist so CI can skip-or-build.',
);
assert.match(
  generated,
  /content:/,
  'Generated legal pages must include markdown content for LegalDocumentPage.',
);

const inRepoTerms = path.join(repoRoot, 'docs', 'legal', 'user-facing', '01_TERMS_AND_CONDITIONS.md');
assert.equal(
  fs.existsSync(inRepoTerms),
  true,
  'Frontend repo must vendor 01_TERMS_AND_CONDITIONS.md so Cloudflare Pages can regenerate without the workspace.',
);

function readPages(source) {
  const match = source.match(/LEGAL_PAGES: LegalPageDefinition\[\] = (\[[\s\S]*?\]);/);
  assert.ok(match, 'Generated legal pages must contain a valid serialized page list.');
  return JSON.parse(match[1]);
}

const pages = readPages(generated);
assert.equal(pages.length, 9, 'All nine legal policies must be published.');
for (const page of pages) {
  const fileName = path.basename(page.sourceDocument);
  const markdown = fs.readFileSync(path.join(repoRoot, 'docs', 'legal', 'user-facing', fileName), 'utf8');
  assert.equal(page.version, '2026.10.19-v1.4');
  assert.equal(page.effectiveDate, 'October 19, 2026');
  assert.equal(page.content, markdown, `${fileName}: published web text must match the isolated-clone source.`);
  assert.match(markdown, /2026\.10\.19-v1\.4/);
  assert.match(markdown, /mandatory consumer rights/);
  assert.match(markdown, /Custom-order subscription queue terms/);

  const workspaceSource = path.resolve(repoRoot, '..', 'docs', 'legal', 'user-facing', fileName);
  if (fs.existsSync(workspaceSource)) {
    assert.equal(markdown, fs.readFileSync(workspaceSource, 'utf8'), `${fileName}: workspace and vendored policy must agree.`);
  }
}

for (const slug of ['terms', 'seller-terms', 'buyer-policy', 'payment-policy']) {
  const page = pages.find((entry) => entry.slug === slug);
  assert.ok(page, `${slug} must exist.`);
  for (const rule of [
    'No outage grace applies',
    'from 48 hours through exactly 12 hours remaining',
    'adding 42 days to the existing deadline',
    '10% of garment subtotal excluding VAT/delivery/jump fee',
    '10% of any jump fee',
    'Delivery is refunded in full',
    'at most two paid-priority orders activate consecutively before one ordinary order',
    'a separate payment',
    'visible promotion hold',
  ]) assert.ok(page.content.includes(rule), `${slug}: missing approved disclosure: ${rule}`);
}

const mobileGeneratedPath = path.resolve(repoRoot, '..', 'threadly-mobile', 'src', 'legal', 'legalDocuments.ts');
if (fs.existsSync(mobileGeneratedPath)) {
  assert.deepEqual(readPages(fs.readFileSync(mobileGeneratedPath, 'utf8')), pages, 'Native and web must publish exactly the same nine policy versions and contents.');
} else {
  console.log('Legal mobile parity skipped: sibling mobile checkout is absent.');
}

const backendConstants = path.resolve(repoRoot, '..', 'bthreadly', 'src', 'legal', 'legal.constants.ts');
if (fs.existsSync(backendConstants)) {
  assert.match(fs.readFileSync(backendConstants, 'utf8'), /LEGAL_VERSION = '2026\.10\.19-v1\.4'/, 'Acceptance version must match published policies.');
} else {
  console.log('Legal acceptance version parity skipped: sibling backend checkout is absent.');
}

console.log('Legal sync CI contract checks passed.');
