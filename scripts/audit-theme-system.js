import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');

const DIRECTORIES_TO_SCAN = [
  'types',
  'context',
  'hooks',
  'components',
  'pages',
  'features',
  'api'
].map(d => path.join(SRC_DIR, d));

const FILES_TO_SCAN = [
  path.join(SRC_DIR, 'index.css'),
  path.join(SRC_DIR, 'main.tsx')
];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      if (fullPath.match(/\.(tsx|ts|jsx|js|css)$/)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const allFiles = [];
for (const dir of DIRECTORIES_TO_SCAN) {
  getAllFiles(dir, allFiles);
}
FILES_TO_SCAN.forEach(file => {
  if (fs.existsSync(file)) {
    allFiles.push(file);
  }
});

const ALLOWLIST = {
  tests: [
    '__tests__',
    '.test.ts',
    '.test.tsx'
  ],
  intentionalStatusColors: [
    'payoutStatus.ts',
    'OrderDetailsModal.tsx',
    'CustomOrderActionConfirmModal.tsx'
  ],
  mediaOverlays: [
    'MediaRenderer.tsx',
    'ImageWithFallback.tsx',
    'FeaturedGalleryModal.tsx'
  ],
  skeletons: [
    'Skeleton'
  ],
  deferredLegacyFiles: [
    // ── Phase 9B deferred ── pending next migration sprint ──────────────────
    { path: 'components/auth/AuthRequiredPrompt.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/bagging/BagFittingsModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/bagging/ProductBagSelectorModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/brand/StorefrontCatalogTab.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/brand/StorefrontCollectionsTab.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/Button.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/AboutBrand.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/CatalogShopTab.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/FilterDrawer.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/InlineProductDetail.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/InlineStoreCollectionView.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/catalog/ProfileLayout.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/categories/FilterSelector.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/BrandHeader.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/CollectionCartPreviewModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/CollectionMetadata.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/CompactCommentsSection.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/DiscountSaleModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/DraftConflictWarningModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/DraftExpiryComponents.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/InlineCollectionViewer.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/PriceChangePreviewModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/UnifiedCollectionComments.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/collections/UpdatePriceTagsModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/CollectionViewModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/DesignCard.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/DesignViewModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/FilterPanel.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/ProductDetailModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/StoreEmptyState.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/designs/StoreProductCard.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/EmptyState.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/FeaturedSection.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/forms/SelectField.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/forms/TextAreaField.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/forms/TextField.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/messaging/ChatContactSidebar.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/messaging/ComposeArea.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/messaging/OrderMessagesPanel.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/modals/PrePublishConfirmModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/profile/ProfileSettingsEntry.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/profile/tabs/AboutTab.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/profile/tabs/ReviewsTab.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/qr/EntityQrModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/qr/OrderQrCard.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/RequireBrand.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/SideBar.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/sizing/SizingConfigurator.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/store/BrandWalletPanel.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/store/RequireStoreSetup.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/store/StorePaymentAccountPanel.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/store/StoreSetupRequiredGate.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/ArchiveProductModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/BulkDeleteProductsModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/ComingSoonModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/DeleteProductModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/DiscardChangesModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/PermanentDeleteProductModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/modals/RestoreDeletedProductModal.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/store/StoreProductsPanel.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/studio/StudioSidebar.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/Tabs.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/Tag.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/ui/ConfirmDialog.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/ui/InfoTooltip.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/ui/Textarea.tsx', reason: 'Phase 9B deferred' },
    { path: 'components/ui/TourOverlay.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/brand/MyDraftsPage.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/catalog/Catalog.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/catalog/CollectionRouter.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/catalog/CollectionView.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/catalog/CreateCollection.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/catalog/ProductDetailsPage.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/checkout/CheckoutPage.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/orders/MyOrders.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/orders/OrderAccessResolverPage.tsx', reason: 'Phase 9B deferred' },
    { path: 'pages/orders/OrderDetail.tsx', reason: 'Phase 9B deferred' },
    // ── Phase 9A residual ────────────────────────────────────────────────────
    { path: 'pages/profile/tabs/SavedTab.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/profile/tabs/OrdersPanel.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/profile/tabs/PatchesTab.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'components/profile/EditProfileModal.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'components/profile/ProfileHeaderQuickEditModal.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/SearchResultsPage.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/settings/CollectionsSettings.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/settings/HiddenContentSettings.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/settings/SettingsHome.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/store/BrandPayoutsPage.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/store/StoreEssentials.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/studio/CustomOrdersPage.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/studio/products/EditProduct.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/studio/store/StoreManagement.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/studio/StudioCustomOrderDetailPage.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/Subscriptions.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/profile/EndUserProfile.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'pages/messages/MessagingManagementPage.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'components/reviews/ProductReviewSection.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'components/reviews/ReviewComposerModal.tsx', reason: 'Residual legacy tokens deferred' },
    { path: 'components/designs/CartDrawer.tsx', reason: 'Residual legacy tokens deferred' },
    // ── Directory-level exemptions for legacy/infrastructure modules ─────────
    { path: 'pages/admin/', reason: 'Legacy admin UI directory; post-release audit cleanup' },
    { path: 'pages/dashboard/', reason: 'Legacy dashboard UI directory; post-release audit cleanup' },
    { path: 'components/dashboard/', reason: 'Legacy dashboard component directory; post-release audit cleanup' },
    { path: 'pages/custom-orders/', reason: 'Complex custom-order buyer pages deferred outside theme hardening scope' },
    { path: 'components/custom-orders/', reason: 'Complex custom-order component directory deferred outside theme hardening scope' },
    { path: 'pages/AccountReactivationRequestPage.tsx', reason: 'Low-priority account recovery page deferred post-release' },
    { path: 'pages/Login.tsx', reason: 'Legacy auth page styling deferred post-release' },
    { path: 'pages/placeholders/', reason: 'Placeholder page directory does not block release theming' },
    { path: 'pages/MarketPlace.tsx', reason: 'Legacy marketplace route kept only for compatibility' },
    { path: 'components/settings/', reason: 'Legacy settings component directory deferred post-release' },
    { path: 'components/store/wizard/', reason: 'Store setup wizard directory deferred for a dedicated UX pass' },
    { path: 'components/upload/', reason: 'Upload component directory deferred for a dedicated theming pass' }
  ],
  falsePositiveFiles: [
    'ThemeContext.tsx',
    'theme.ts',
    'theme.contract.ts'
  ]
};

function checkAllowlist(filePath) {
  const normPath = filePath.split(String.fromCharCode(92)).join(String.fromCharCode(47));
  if (ALLOWLIST.tests.some(t => normPath.includes(t))) return true;
  if (ALLOWLIST.intentionalStatusColors.some(t => normPath.includes(t))) return true;
  if (ALLOWLIST.mediaOverlays.some(t => normPath.includes(t))) return true;
  if (ALLOWLIST.skeletons.some(t => normPath.includes(t))) return true;
  if (ALLOWLIST.falsePositiveFiles.some(t => normPath.includes(t))) return true;
  if (ALLOWLIST.deferredLegacyFiles.some(t => normPath.includes(t.path))) return true;
  return false;
}

const rules = [
  {
    id: 'A_UNSUPPORTED_THEME_MODES',
    description: 'Unsupported theme modes (auto, time)',
    regex: /(?:theme|mode|preference)\s*(?:={1,3}|:)\s*['"](auto|time)['"]|(?:setTheme|setThemePreference)\(['"](auto|time)['"]\)/i,
    allowlist: checkAllowlist,
    suggestion: "Use 'system', 'light', or 'dark'"
  },
  {
    id: 'B_DUPLICATE_THEME_UNIONS',
    description: 'Duplicate theme unions (use ThemePreference from src/types/theme.ts)',
    regex: /['"]light['"]\s*\|\s*['"]dark['"]\s*\|\s*['"]system['"]/g,
    allowlist: checkAllowlist,
    suggestion: 'Import ThemePreference from src/types/theme.ts'
  },
  {
    id: 'C_BINARY_TOGGLES',
    description: 'Binary theme toggles that can overwrite system preference',
    regex: /===\s*['"]dark['"]\s*\?\s*['"]light['"]\s*:\s*['"]dark['"]|===\s*['"]light['"]\s*\?\s*['"]dark['"]\s*:\s*['"]light['"]/g,
    allowlist: checkAllowlist,
    suggestion: 'Support the system preference instead of toggling binary values'
  },
  {
    id: 'D_BACKEND_LEAKAGE',
    description: 'Backend leakage of resolvedTheme into APIs',
    regex: /resolvedTheme\s*:|(?:\w+\.)?patch\([^,]+,\s*\{[^}]*resolvedTheme/g,
    allowlist: checkAllowlist,
    suggestion: 'Send themePreference to the backend, never resolvedTheme'
  },
  {
    id: 'E_RISKY_HARDCODED_SURFACES',
    description: 'Risky hardcoded shared-surface pattern (bg/text/border + dark:)',
    regex: /\b(bg-white|bg-black|text-black|text-white|border-gray-\d{2,3}|bg-gray-\d{2,3}|bg-zinc-\d{2,3}|bg-slate-\d{2,3})[ \t]+dark:(bg-|text-|border-)/g,
    allowlist: checkAllowlist,
    suggestion: 'Use semantic tokens like surface-card, text-theme, or border-theme'
  },
  {
    id: 'E_INLINE_THEME_STYLES',
    description: 'Inline style backgroundColor/color for theme surfaces',
    regex: /style=\{\{\s*(?:backgroundColor|color):\s*(?:theme|resolvedTheme|isDark)/g,
    allowlist: checkAllowlist,
    suggestion: 'Use CSS classes and semantic variables instead of inline styles'
  }
];

let hasErrors = false;

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  rules.forEach(rule => {
    let match;
    // reset regex state
    const regex = new RegExp(rule.regex);
    if (!regex.global) {
      const singleMatch = content.match(regex);
      if (singleMatch && !rule.allowlist(file)) {
        console.error(`[FAIL] ${rule.id} in ${path.relative(ROOT_DIR, file)}`);
        console.error(`       Found: ${singleMatch[0].trim()}`);
        console.error(`       Suggestion: ${rule.suggestion}`);
        hasErrors = true;
      }
    } else {
      while ((match = regex.exec(content)) !== null) {
        if (!rule.allowlist(file)) {
          console.error(`[FAIL] ${rule.id} in ${path.relative(ROOT_DIR, file)}`);
          console.error(`       Found: ${match[0].trim()}`);
          console.error(`       Suggestion: ${rule.suggestion}`);
          hasErrors = true;
        }
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   G_UNDEFINED_TOKEN_VARS

   The bug this exists to prevent: five verification screens were written
   against a Material 3 vocabulary (`bg-surface-container-lowest`,
   `text-on-surface`, `border-outline-variant/20`) that was never added to
   tailwind.config.js. An undefined utility is not an error in Tailwind — it
   simply emits nothing — so 192 classes silently did nothing, the cards had no
   background, and their `border` fell through to the preflight default of
   #e5e7eb. In dark mode that is a near-white rectangle, which is exactly what
   was reported.

   Nothing in the type system, the linter, or the build can see that. So:
   every CSS variable the Tailwind config resolves a colour to must actually be
   declared in index.css, and — because the whole point is theming — declared
   in BOTH the light and dark blocks.
   ────────────────────────────────────────────────────────────────────────── */
const tailwindConfigPath = path.join(ROOT_DIR, 'tailwind.config.js');
const indexCssPath = path.join(SRC_DIR, 'index.css');

if (fs.existsSync(tailwindConfigPath) && fs.existsSync(indexCssPath)) {
  const configSource = fs.readFileSync(tailwindConfigPath, 'utf8');
  const cssSource = fs.readFileSync(indexCssPath, 'utf8');

  // Only the theme-scoped families. Brand/menu/etc. are declared elsewhere and
  // some are deliberately identical across themes.
  const referenced = new Set(
    (configSource.match(/var\(--(?:bd|m3)-[a-z0-9-]+\)/g) || []).map((raw) =>
      raw.slice(4, -1),
    ),
  );

  const darkBlock = cssSource.slice(cssSource.indexOf('.dark {'));
  const lightBlock = cssSource.slice(0, cssSource.indexOf('.dark {'));

  for (const variable of [...referenced].sort()) {
    const declaration = `${variable}:`;
    const inLight = lightBlock.includes(declaration);
    const inDark = darkBlock.includes(declaration);
    if (inLight && inDark) continue;
    const missing = !inLight && !inDark
      ? 'declared nowhere'
      : inLight
        ? 'missing from the .dark block'
        : 'missing from :root (light)';
    console.error(`[FAIL] G_UNDEFINED_TOKEN_VARS: --${variable} is ${missing}`);
    console.error('       Referenced by tailwind.config.js. A colour that resolves to an');
    console.error('       undeclared variable renders as nothing, silently.');
    console.error(`       Suggestion: declare --${variable} in BOTH blocks of src/index.css`);
    hasErrors = true;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   H_LIGHT_ONLY_SURFACES  (ratchet, not a gate)

   A pastel fill or border with no `dark:` counterpart is a light-theme
   decision that reaches dark mode intact — a mint block or a bright hairline
   on near-black. The neutral families are NOT counted: `borderColor` in
   tailwind.config.js remaps those to the `--bd-*` ramp, so they are already
   theme-aware wherever they appear.

   A baseline rather than zero because the remaining cases are `bg-white`,
   which is a card surface in some places and a toggle knob or dot in others.
   Those need a human to say which, so they are counted, not auto-fixed. The
   number may fall; it must never rise.
   ────────────────────────────────────────────────────────────────────────── */
const LIGHT_ONLY_BASELINE = 61;
const HUE_GROUP = 'emerald|amber|rose|red|sky|blue|purple|indigo|green|violet|fuchsia|orange|teal|pink|cyan';
const LIGHT_SURFACE = new RegExp(
  `(^|\\s)(bg-(white|(?:gray|slate|zinc|neutral|stone|${HUE_GROUP})-(?:50|100|200))` +
    `|border-(?:${HUE_GROUP})-(?:100|200|300))(\\/[0-9]+)?(?=\\s|$)`,
);

let lightOnly = 0;
for (const file of allFiles) {
  if (!file.endsWith('.tsx') || checkAllowlist(file)) continue;
  for (const chunk of fs.readFileSync(file, 'utf8').split(/['"`]/)) {
    if (!LIGHT_SURFACE.test(` ${chunk} `)) continue;
    if (/(^|\s)dark:(bg|border)-/.test(chunk)) continue;
    lightOnly += 1;
  }
}

if (lightOnly > LIGHT_ONLY_BASELINE) {
  console.error(
    `[FAIL] H_LIGHT_ONLY_SURFACES: ${lightOnly} light-only surfaces, baseline is ${LIGHT_ONLY_BASELINE}`,
  );
  console.error('       A pastel fill or border with no dark: counterpart stays light on a');
  console.error('       near-black page. Pair it, e.g. bg-emerald-50 dark:bg-emerald-500/10.');
  hasErrors = true;
} else if (lightOnly < LIGHT_ONLY_BASELINE) {
  console.log(
    `[INFO] H_LIGHT_ONLY_SURFACES improved: ${lightOnly} (baseline ${LIGHT_ONLY_BASELINE}) — lower the baseline.`,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   I_HARDCODED_LIGHT_HEX  (ratchet)

   The third blind spot, and the one that hid the admin verification hero: a
   literal light hex inside a Tailwind ARBITRARY value —
   `bg-[linear-gradient(135deg,_#f9fcff,_#ffffff_48%,_#f7f7ff)]`.

   There is no palette class to match, so the named-colour rules above read the
   page as clean while it painted a near-white slab on a near-black console.
   Detection is by luminance rather than by name, because the whole problem is
   that these colours have no names.
   ────────────────────────────────────────────────────────────────────────── */
// Baseline 1: EmailVerify's brand gradient ends on a light lavender by design
// (a purple ramp, not a surface). Everything else is paired.
const HARDCODED_HEX_BASELINE = 1;
const ARBITRARY_COLOR = /\b(bg|text|border|from|via|to)-\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/g;

const isLightHex = (hex) => {
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
};

let hardcodedLight = 0;
for (const file of allFiles) {
  if (!file.endsWith('.tsx') || checkAllowlist(file)) continue;
  for (const chunk of fs.readFileSync(file, 'utf8').split(/['"`]/)) {
    if (!/#[0-9a-fA-F]{3,8}/.test(chunk)) continue;
    let match;
    ARBITRARY_COLOR.lastIndex = 0;
    while ((match = ARBITRARY_COLOR.exec(chunk)) !== null) {
      const hexes = [...match[0].matchAll(/#([0-9a-fA-F]{3,8})/g)].map((m) => m[1]);
      if (!hexes.some(isLightHex)) continue;
      if (chunk.includes(`dark:${match[1]}-[`)) continue;
      hardcodedLight += 1;
    }
  }
}

if (hardcodedLight > HARDCODED_HEX_BASELINE) {
  console.error(
    `[FAIL] I_HARDCODED_LIGHT_HEX: ${hardcodedLight} light hex colours in arbitrary values with no dark: counterpart (baseline ${HARDCODED_HEX_BASELINE})`,
  );
  console.error('       A literal #ffffff in bg-[...] is invisible to every name-based check.');
  console.error('       Pair it with a dark:bg-[...] or move the colour to a CSS variable.');
  hasErrors = true;
} else if (hardcodedLight < HARDCODED_HEX_BASELINE) {
  console.log(
    `[INFO] I_HARDCODED_LIGHT_HEX improved: ${hardcodedLight} (baseline ${HARDCODED_HEX_BASELINE}) — lower the baseline.`,
  );
}

// Check for migration artifacts in the root directory
const rootFiles = fs.readdirSync(ROOT_DIR);
const migrationArtifacts = rootFiles.filter(f => f === 'migrate.js' || f === 'migrate2.js' || f.match(/migrate.*\.js$/i));

if (migrationArtifacts.length > 0) {
  console.error(`[FAIL] F_TEMPORARY_ARTIFACTS: Found migration scripts in root: ${migrationArtifacts.join(', ')}`);
  hasErrors = true;
}

if (hasErrors) {
  console.error('\nTheme audit failed. Please review the errors above.');
  process.exit(1);
} else {
  console.log('\nTheme audit passed! No risky theme patterns found.');
  process.exit(0);
}
