const fs = require('fs');
const path = require('path');
const ts = require('typescript');

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

// The policy this guards is "a STALE query must not refetch on mount" — not the
// literal `false`. A bare `false` also suppressed refetching for explicitly
// INVALIDATED queries, which silently broke every invalidateQueries call in the
// app. The predicate keeps the perf policy and restores the invalidation
// contract; both halves are asserted so neither can be dropped.
assertIncludes(
  'src/query/queryClient.ts',
  "refetchOnMount: (query) => (query.state.isInvalidated ? 'always' : false)",
  'stale queries must not refetch on mount, but invalidated ones must',
);
assertIncludes('src/query/queryClient.ts', 'refetchOnWindowFocus: false', 'query defaults must not refetch on focus');
// Constants carry the WIEZ_ prefix since the brand rename. These two still named
// them THREADLY_*, so they had been failing on every run rather than protecting
// anything (same defect already corrected in threadly-mobile's guard).
assertIncludes('src/query/queryClient.ts', 'staleTime: WIEZ_QUERY_STALE_TIME_MS', 'query defaults must keep shared staleTime');
assertIncludes('src/query/queryClient.ts', 'gcTime: WIEZ_QUERY_GC_TIME_MS', 'query defaults must keep shared gcTime');

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
// Retention and freshness are separate: reuse an inactive capability, but
// authorize it again when stale/expired and never render an expired URL.
assertIncludes('src/hooks/useSignedFileUrl.ts', 'gcTime: WIEZ_MEDIA_URL_GC_TIME_MS', 'media queries must use the shared retention window');
assertIncludes('src/hooks/useSignedFileUrl.ts', 'staleTime: mustRefresh ? 0 : WIEZ_QUERY_STALE_TIME_MS', 'forced refresh must bypass freshness without discarding the retention policy');
assertIncludes('src/hooks/useSignedFileUrl.ts', '!isUsableMediaUrl(cached)', 'expired cached capabilities must be removed');
assertIncludes('src/hooks/useSignedFileUrl.ts', 'getMediaUrlExpiryMs(url)', 'mounted media must schedule an expiry refresh');

assertOrder(
  'src/components/designs/DesignViewModalContent.tsx',
  'queryKeys.media.publicUrl(m.fileId)',
  'queryKeys.media.signedUrl(m.fileId)',
  'design modal media hydration must stay public-first',
);
assertIncludes('src/components/designs/DesignViewModalContent.tsx', 'retry: false', 'design modal media fallback must not retry public-denial loops');
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
    // Inspect executable literals, not documentation comments describing the
    // centralized API. Both ordinary and interpolated endpoint strings count.
    const source = ts.createSourceFile(relative, content, ts.ScriptTarget.Latest, true);
    let referencesEndpoint = false;
    const visit = (node) => {
      if ((ts.isStringLiteralLike(node) || node.kind === ts.SyntaxKind.TemplateHead)
          && node.text.includes('/uploads/signed-url')) referencesEndpoint = true;
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (referencesEndpoint) signedUrlReferences.push(relative);
  }
};
walk('src');
const allowedSignedUrlFiles = new Set(['src/api/BrandApi.ts']);
for (const relative of signedUrlReferences) {
  if (!allowedSignedUrlFiles.has(relative)) {
    fail(`${relative}: signed URL endpoint calls must stay centralized in BrandApi`);
  }
}

// Vite supplies HTML preload paths relative to dist ("assets/..."), not
// necessarily root-relative. Verify the actual artifact to catch filter drift.
if (fs.existsSync(path.join(repoRoot, 'dist', 'index.html'))) {
  const html = read('dist/index.html');
  const preloadTags = html.match(/<link\b[^>]*rel="modulepreload"[^>]*>/g) ?? [];
  for (const vendor of ['react-vendor', 'router-vendor', 'redux-vendor']) {
    if (!preloadTags.some(tag => tag.includes(`/assets/${vendor}-`))) {
      fail(`dist/index.html: missing ${vendor} module preload; do not introduce an entry-to-vendor request waterfall`);
    }
  }
  if (preloadTags.some(tag => !/\/assets\/(?:react-vendor|router-vendor|redux-vendor)-/.test(tag))) {
    fail('dist/index.html: public boot must not preload unopened feature/admin routes');
  }
  const routeBootstrap = read('dist/boot/route-preload.js');
  const routesMatch = routeBootstrap.match(/var routes = ([^\n]+);/);
  if (!routesMatch) fail('dist/boot/route-preload.js: production route hashes were not generated');
  else {
    const routes = JSON.parse(routesMatch[1]);
    for (const route of ['/', '/runway', '/market']) {
      if (!Array.isArray(routes[route]) || routes[route].length === 0) fail(`Missing initial-route hints for ${route}`);
      for (const href of routes[route] ?? []) {
        if (!/^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(href) || !fs.existsSync(path.join(repoRoot, 'dist', href.slice(1)))) {
          fail(`Invalid or missing built initial-route asset: ${href}`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Performance regression guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Performance regression guard passed.');
