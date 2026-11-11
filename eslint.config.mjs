// ESLint 9 (flat config) do monorepo inteiro (QA-01). Um arquivo só, na raiz:
//   npm run lint            → tudo
//   npm run lint:api | lint:web
//
// Base: recomendadas do ESLint e do typescript-eslint. No código de produção (apps/*/src) entram
// também as regras que precisam de tipos e pegam promise solta, que foi a causa do DOM-06 (a API
// caía com uma rejeição sem tratamento). O web soma as regras do Next (core-web-vitals).
// Formatação é do Prettier: o eslint-config-prettier desliga as regras de estilo.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rootDir = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: rootDir });

const WEB_FILES = ['apps/web/**/*.{ts,tsx,js,jsx,mjs}'];
const TYPED_FILES = [
  'apps/api/src/**/*.ts',
  'apps/web/src/**/*.{ts,tsx}',
  'packages/*/src/**/*.ts',
];

// As regras do Next vêm no formato antigo (eslintrc); o FlatCompat converte e aqui elas ficam
// restritas ao app web.
const nextConfigs = compat
  .config({ extends: ['next/core-web-vitals'], settings: { next: { rootDir: 'apps/web/' } } })
  .map((config) => ({ ...config, files: WEB_FILES }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      '**/*.tsbuildinfo',
      'apps/api/prisma/migrations/**',
      'apps/web/public/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'auditoria/**',
      '.claude/**',
      '.agents/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextConfigs,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },

  // API: nada de console solto no código de produção (o logger estruturado é o `lib/logger`).
  {
    files: ['apps/api/src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },

  // Código de produção, com informação de tipos.
  {
    files: TYPED_FILES,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: rootDir },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Handlers de evento do React e callbacks do Express podem ser async.
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  {
    files: WEB_FILES,
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // Playwright: `async ({}, use)` é o formato das fixtures, e um argumento pode existir só para
  // dar o tipo (`typeof userA`).
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },

  // Scripts e configs em CommonJS/ESM puro.
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  prettier,
);
