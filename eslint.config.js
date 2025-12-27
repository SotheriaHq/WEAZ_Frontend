import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import noRawMediaElements from './eslint-rules/no-raw-media-elements.js'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      threadly: {
        rules: {
          'no-raw-media-elements': noRawMediaElements,
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // Global invariant: forbid raw <img>/<video> (use MediaRenderer).
      'threadly/no-raw-media-elements': [
        'error',
        {
          // Temporary allowlist for legacy/decorative usage. Tighten over time.
          allowFiles: [
            'src/pages/Login.tsx',
            'src/pages/SignUp.tsx',
          ],
        },
      ],
    },
  },
])
