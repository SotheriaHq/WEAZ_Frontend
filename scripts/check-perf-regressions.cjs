const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const failures = [];

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const fail = (message) => failures.push(message);

const assertIncludes = (relativePath, needle, message) => {
  const content = read(relativePath);
  if (!content.includes(needle)) fail(`${relativePath}: ${message}`);
};

const assertNotMatches = (relativePath, pattern, message) => {
  const content = read(relativePath);
  if (pattern.test(content)) fail(`${relativePath}: ${message}`);
};

const assertOrder = (relativePath, firstNeedle, secondNeedle, message) => {
  const content = read(relativePath);
  const first = content.indexOf(firstNeedle);
  const second = content.indexOf(secondNeedle);
  if (first < 0 || second < 0 || first > second) fail(`${relativePath}: ${message}`);
};

const extractFunction = (relativePath, signature) => {
  const content = read(relativePath);
  const start = content.indexOf(signature);
  if (start < 0) {
    fail(`${relativePath}: missing ${signature}`);
    return '';
  }
  const rest = content.slice(start + signature.length);
  const next = rest.search(/\n\s{2}async\s+\w+/);
  return content.slice(start, next >= 0 ? start + signature.length + next : content.length);
};

const assertCacheBypassIsForceGuarded = (label, content) => {
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const isBypass =
      line.includes('_cb') ||
      /Cache-Control['"]?\s*:\s*['"]no-store['"]/.test(line) ||
      /Pragma['"]?\s*:\s*['"]no-cache['"]/.test(line);
    if (!isBypass) return;

    const windowStart = Math.max(0, index - 10);
    const context = lines.slice(windowStart, index + 1).join('\n');
    if (!/forceRefresh|options\?\.forceRefresh|opts\?\.forceRefresh/.test(context)) {
      fail(`${label}:${index + 1}: cache bypass must be guarded by explicit forceRefresh`);
    }
  });
};

assertIncludes('src/query/queryClient.ts', 'refetchOnMount: false', 'query defaults must not refetch on mount');
assertIncludes('src/query/queryClient.ts', 'refetchOnWindowFocus: false', 'query defaults must not refetch on focus');
assertIncludes('src/query/queryClient.ts', 'staleTime: THREADLY_QUERY_STALE_TIME_MS', 'query defaults must keep shared staleTime');
assertIncludes('src/query/queryClient.ts', 'gcTime: THREADLY_QUERY_GC_TIME_MS', 'query defaults must keep shared gcTime');

assertNotMatches('src/query/queryKeys.ts', /Date\.now\(|Math\.random\(/, 'query keys must stay deterministic');
assertIncludes('src/query/queryKeys.ts', "scope === 'publicUrl'", 'public media URLs should remain persistable');
assertNotMatches('src/query/queryKeys.ts', /scope\s*===\s*['"]signedUrl['"]/, 'private signed URLs must not be persisted');
assertNotMatches('src/query/QueryProvider.tsx', /invalidateQueries\s*\(/, 'provider must not invalidate queries broadly');

assertOrder(
  'src/hooks/useSignedFileUrl.ts',
  'queryKeys.media.publicUrl(fileId)',
  'queryKeys.media.signedUrl(fileId)',
  'media hook must try public URLs before private signed fallback',
);
assertIncludes('src/hooks/useSignedFileUrl.ts', 'retry: false', 'media public denial must not retry into request spam');
assertIncludes('src/hooks/useSignedFileUrl.ts', 'gcTime: THREADLY_QUERY_STALE_TIME_MS', 'signed media query cache must stay short-lived');

assertOrder(
  'src/components/designs/DesignViewModal.tsx',
  'queryKeys.media.publicUrl(m.fileId)',
  'queryKeys.media.signedUrl(m.fileId)',
  'design modal media hydration must stay public-first',
);
assertIncludes('src/components/designs/DesignViewModal.tsx', 'retry: false', 'design modal media fallback must not retry public-denial loops');
assertIncludes('src/components/ImageWithFallback.tsx', 'isUsableInitialUrl(src)', 'stable public URLs must be used directly');
assertIncludes('src/components/ImageWithFallback.tsx', 'resolveSignedUrl', 'signed URL resolution must stay deduped');

assertCacheBypassIsForceGuarded('src/api/DesignApi.ts', read('src/api/DesignApi.ts'));
assertCacheBypassIsForceGuarded(
  'src/api/BrandApi.ts#getCollectionDetail',
  extractFunction('src/api/BrandApi.ts', 'async getCollectionDetail'),
);

const signedUrlReferences = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'build'].includes(entry.name)) walk(relative);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|cjs)$/.test(entry.name)) continue;
    const content = read(relative);
    if (content.includes('/uploads/signed-url')) signedUrlReferences.push(relative);
  }
};
walk('src');
const allowedSignedUrlFiles = new Set(['src/api/BrandApi.ts']);
for (const relative of signedUrlReferences) {
  if (!allowedSignedUrlFiles.has(relative)) {
    fail(`${relative}: signed URL endpoint calls must stay centralized in BrandApi`);
  }
}

if (failures.length > 0) {
  console.error('Performance regression guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Performance regression guard passed.');
