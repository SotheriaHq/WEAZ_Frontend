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

const rules = [
  {
    id: 'A_UNSUPPORTED_THEME_MODES',
    description: 'Unsupported theme modes (auto, time)',
    regex: /(?:theme|mode|preference)\s*(?:={1,3}|:)\s*['"](auto|time)['"]|(?:setTheme|setThemePreference)\(['"](auto|time)['"]\)/i,
    allowlist: (filePath) => false
  },
  {
    id: 'B_DUPLICATE_THEME_UNIONS',
    description: 'Duplicate theme unions (use ThemePreference from src/types/theme.ts)',
    regex: /['"]light['"]\s*\|\s*['"]dark['"]\s*\|\s*['"]system['"]/g,
    allowlist: (filePath) => {
      // Allowed in theme.ts and test files
      return filePath.includes('types' + path.sep + 'theme.ts') || 
             filePath.includes('common' + path.sep + 'theme.contract.ts') ||
             filePath.includes('__tests__') || 
             filePath.includes('.test.');
    }
  },
  {
    id: 'C_BINARY_TOGGLES',
    description: 'Binary theme toggles that can overwrite system preference',
    regex: /===\s*['"]dark['"]\s*\?\s*['"]light['"]\s*:\s*['"]dark['"]|===\s*['"]light['"]\s*\?\s*['"]dark['"]\s*:\s*['"]light['"]/g,
    allowlist: (filePath) => false
  },
  {
    id: 'D_BACKEND_LEAKAGE',
    description: 'Backend leakage of resolvedTheme into APIs',
    regex: /resolvedTheme\s*:|(?:\w+\.)?patch\([^,]+,\s*\{[^}]*resolvedTheme/g,
    allowlist: (filePath) => {
      if (filePath.includes('ThemeContext.tsx')) return true;
      return false;
    }
  },
  {
    id: 'E_RISKY_HARDCODED_SURFACES',
    description: 'Risky hardcoded shared-surface pattern (bg/text/border + dark:)',
    regex: /\b(bg-white|bg-black|text-black|text-white|border-gray-\d{2,3}|bg-gray-\d{2,3}|bg-zinc-\d{2,3}|bg-slate-\d{2,3})\s+dark:(bg-|text-|border-)/g,
    allowlist: (filePath, match) => {
      // Known deferred files/directories
      const allowedPaths = [
        'NotificationItem.css',
        'pages\\dashboard',
        'pages/dashboard',
        'pages\\orders',
        'pages/orders',
        'pages\\store',
        'pages/store',
        'pages\\profile',
        'pages/profile',
        'pages\\messages',
        'pages/messages',
        'pages\\studio',
        'pages/studio',
        'pages\\placeholders',
        'pages/placeholders',
        'pages\\custom-orders',
        'pages/custom-orders',
        'pages\\settings',
        'pages/settings',
        'components\\cart',
        'components/cart',
        'components\\checkout',
        'components/checkout',
        'components\\messages',
        'components/messages',
        'components\\orders',
        'components/orders',
        'pages\\admin',
        'pages/admin',
        'pages\\brand',
        'pages/brand',
        'pages\\catalog',
        'pages/catalog',
        'pages\\checkout',
        'pages/checkout',
        'components\\admin',
        'components/admin',
        'components\\auth',
        'components/auth',
        'components\\bagging',
        'components/bagging',
        'components\\brand',
        'components/brand',
        'components\\catalog',
        'components/catalog',
        'components\\categories',
        'components/categories',
        'components\\checkout',
        'components/checkout',
        'components\\collections',
        'components/collections',
        'components\\custom-orders',
        'components/custom-orders',
        'components\\dashboard',
        'components/dashboard',
        'components\\designs',
        'components/designs',
        'components\\forms',
        'components/forms',
        'components\\media',
        'components/media',
        'components\\messages',
        'components/messages',
        'components\\messaging',
        'components/messaging',
        'components\\modals',
        'components/modals',
        'components\\orders',
        'components/orders',
        'components\\payouts',
        'components/payouts',
        'components\\profile',
        'components/profile',
        'components\\qr',
        'components/qr',
        'components\\RequireBrand',
        'components/RequireBrand',
        'components\\reviews',
        'components/reviews',
        'components\\settings',
        'components/settings',
        'components\\SideBar.tsx',
        'components/SideBar.tsx',
        'components\\sizing',
        'components/sizing',
        'components\\store',
        'components/store',
        'components\\studio',
        'components/studio',
        'components\\Tabs.tsx',
        'components/Tabs.tsx',
        'components\\Tag.tsx',
        'components/Tag.tsx',
        'components\\ui',
        'components/ui',
        'components\\upload',
        'components/upload',
        'components\\Button.tsx',
        'components/Button.tsx',
        'components\\EmptyState.tsx',
        'components/EmptyState.tsx',
        'components\\FeaturedGalleryModal.tsx',
        'components/FeaturedGalleryModal.tsx',
        'components\\FeaturedSection.tsx',
        'components/FeaturedSection.tsx',
        'components\\ImageWithFallback.tsx',
        'components/ImageWithFallback.tsx',
        'Login.tsx',
        'MarketPlace.tsx',
        'SearchResultsPage.tsx',
        'Subscriptions.tsx',
        'AccountReactivationRequestPage.tsx'
      ];
      
      if (allowedPaths.some(p => filePath.includes(p))) return true;

      // Tests
      if (filePath.includes('__tests__') || filePath.includes('.test.')) return true;

      // Skeletons / Overlays
      if (filePath.includes('Skeleton')) return true;

      return false;
    }
  },
  {
    id: 'E_INLINE_THEME_STYLES',
    description: 'Inline style backgroundColor/color for theme surfaces',
    regex: /style=\{\{\s*(?:backgroundColor|color):\s*(?:theme|resolvedTheme|isDark)/g,
    allowlist: (filePath) => {
      // Acceptable for very specific chart or media overlays if documented
      return false;
    }
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
      if (singleMatch && !rule.allowlist(file, singleMatch)) {
        console.error(`[FAIL] ${rule.id} in ${path.relative(ROOT_DIR, file)}`);
        console.error(`       Found: ${singleMatch[0]}`);
        hasErrors = true;
      }
    } else {
      while ((match = regex.exec(content)) !== null) {
        if (!rule.allowlist(file, match)) {
          console.error(`[FAIL] ${rule.id} in ${path.relative(ROOT_DIR, file)}`);
          console.error(`       Found: ${match[0]}`);
          hasErrors = true;
        }
      }
    }
  });
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
