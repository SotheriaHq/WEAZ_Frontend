import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function collectRouteAssets(manifest, entry) {
  const seen = new Set();
  const assets = new Set();
  const add = file => {
    if (!/^assets\/[A-Za-z0-9_./-]+\.(?:js|css)$/.test(file) || file.split('/').includes('..')) {
      throw new Error(`Unexpected initial-route asset: ${file}`);
    }
    assets.add(`/${file}`);
  };
  const visit = key => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing initial-route manifest entry: ${key}`);
    add(chunk.file);
    for (const css of chunk.css ?? []) add(css);
    // Dynamic imports are unopened interactions/routes, not render dependencies.
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  visit(entry);
  return [...assets];
}

export function renderRoutePreloads(routes) {
  return `// Generated from this build's Vite manifest.\n(function () {\n` +
    `var routes = ${JSON.stringify(routes)};\n` +
    `var current = window.location.pathname.replace(/\\/+$/, '') || '/';\n` +
    `var assets = routes[current] || [];\n` +
    `assets.forEach(function (href) {\n` +
    `  if (document.querySelector('link[href="' + href + '"]')) return;\n` +
    `  var link = document.createElement('link');\n` +
    `  link.rel = /\\.css$/.test(href) ? 'preload' : 'modulepreload';\n` +
    `  if (link.rel === 'preload') link.as = 'style';\n` +
    `  link.href = href; link.crossOrigin = ''; document.head.appendChild(link);\n` +
    `});\n})();\n`;
}

export function generateRoutePreloads(root) {
  const dist = path.join(root, 'dist');
  const manifestPath = path.join(dist, '.vite', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const runway = collectRouteAssets(manifest, 'src/pages/Runway.tsx');
  const market = collectRouteAssets(manifest, 'src/pages/MarketPlace.tsx');
  for (const href of new Set([...runway, ...market])) {
    if (!fs.existsSync(path.join(dist, href.slice(1)))) throw new Error(`Missing built route asset: ${href}`);
  }
  fs.writeFileSync(path.join(dist, 'boot', 'route-preload.js'), renderRoutePreloads({ '/': runway, '/runway': runway, '/market': market }));
  // This is build metadata; the public bootstrap contains only necessary URLs.
  fs.unlinkSync(manifestPath);
  console.log(`Initial-route preloads generated: Runway ${runway.length}, Market ${market.length}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateRoutePreloads(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
