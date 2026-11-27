import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * src/lib is split into layers. A layer may import from the layers below it,
 * never from the ones above, so pure logic stays testable in Node and the
 * data boundary code does not depend on the screens.
 *
 *   views, components
 *   lib/state   navigation, user actions, model status
 *   lib/ai      everything that calls Firebase AI Logic
 *   lib/data    IndexedDB, Privacy Ledger, import, export
 *   lib/core    pure logic: no browser API, no model
 *   lib/util    small shared helpers
 */
function layer(name, forbidden) {
  return {
    files: [`src/lib/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: forbidden.map((other) => `../${other}/*`),
              message: `lib/${name} must not import from ${forbidden.map((other) => `lib/${other}`).join(', ')} (see eslint.config.js).`,
            },
            { group: ['../../views/*', '../../components/*'], message: 'lib/ must not import from views or components.' },
          ],
        },
      ],
    },
  };
}

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.{ts,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The service worker template; vite.config.ts replaces __PRECACHE__ at build time.
    files: ['sw/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, __PRECACHE__: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  layer('util', ['core', 'data', 'ai', 'state']),
  layer('core', ['data', 'ai', 'state']),
  layer('data', ['ai', 'state']),
  layer('ai', ['state']),
  {
    // Pure logic is run directly by Node in scripts/, without a bundler.
    files: ['src/lib/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../data/*', '../ai/*', '../state/*'], message: 'lib/core must not import from lib/data, lib/ai, lib/state (see eslint.config.js).' },
            { group: ['../../views/*', '../../components/*'], message: 'lib/ must not import from views or components.' },
          ],
          paths: [
            { name: 'firebase/ai', message: 'lib/core has no model calls; use lib/ai.' },
            { name: 'dexie', message: 'lib/core has no storage; use lib/data.' },
            { name: 'react', message: 'lib/core has no UI code.' },
          ],
        },
      ],
    },
  },
]);
