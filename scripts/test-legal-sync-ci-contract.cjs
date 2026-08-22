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

console.log('Legal sync CI contract checks passed.');
