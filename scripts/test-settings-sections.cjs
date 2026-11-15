const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) walk(p); else if (p.endsWith('.tsx') && !/\.test\./.test(p)) files.push(p); } }
walk('src/components/settings'); walk('src/pages/settings');
const choiceLabels = new Set(['Coming Soon', 'Public profile', 'Private profile', 'Need a break?', 'Nothing hidden yet']);
let headings = 0;
for (const file of files) {
  if (/SettingsSectionHeading\.tsx$|SettingsSidebar\.tsx$/.test(file)) continue;
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(tree);
      if (tag === 'SettingsSectionHeading') headings += 1;
      if (tag === 'h2' || tag === 'h3') {
        const text = node.children.filter(ts.isJsxText).map(child => child.text).join(' ').replace(/\s+/g, ' ').trim();
        assert.ok(tag !== 'h2', file + ': section headings must use SettingsSectionHeading');
        // Dynamic content names remain semantic card titles; static section labels use the primitive.
        assert.ok(!text || choiceLabels.has(text), file + ': migrate section label "' + text + '" to SettingsSectionHeading');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
assert.ok(headings >= 35, 'Settings screens must use the shared section heading');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
assert.match(css, /\.wiez-settings-screen \[data-settings-section\] \{[^}]*border: 0 !important;[^}]*border-radius: 0 !important;[^}]*background: transparent !important;/);
assert.doesNotMatch(css, /\.wiez-settings-screen[^{}]*:is\(h2, h3\)/, 'do not draw a second pseudo-divider on all headings/card titles');
assert.doesNotMatch(css, /\.wiez-settings-screen[^{}]*(?:input|fieldset|button)[^{}]*\{[^}]*border: 0/, 'functional controls must retain their boundaries');
for (const file of ['src/pages/settings/SettingsHome.tsx', 'src/pages/settings/CollectionsSettings.tsx', 'src/pages/settings/MfaRecoveryPage.tsx']) assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /wiez-settings-screen/, file + ': standalone Settings must share the scoped section styles');
console.log('Settings section inventory, scoped bare containers and functional-control boundaries passed (' + headings + ' shared headings).');
