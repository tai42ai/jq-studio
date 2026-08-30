// @ts-check
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the standalone `@tai42/jq-studio` package.
 *
 * The `no-restricted-imports` block is the INDEPENDENCE gate: jq-studio is the
 * product any app imports, so it must depend on no design system and no host. It
 * renders through its OWN primitives (`src/primitives`), never `@tai42/studio-sdk`
 * — a host substitutes its components through `PrimitivesProvider` instead. (The
 * build additionally asserts no `@tai42/studio-sdk` string survives into `dist`.)
 */
export default tseslint.config(
  {
    // e2e is a standalone consumer project with its own toolchain (Playwright +
    // Vite); it is not part of this package's TypeScript program.
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'e2e/**', '**/*.tsbuildinfo'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // INDEPENDENCE: jq-studio depends on no design system and no host. It must never
  // import `@tai42/studio-sdk` (a host injects its components via PrimitivesProvider).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tai42/studio-sdk', '@tai42/studio-sdk/*'],
              message:
                'jq-studio is design-system-agnostic: render through src/primitives, and let a host substitute its own components via PrimitivesProvider — never import @tai42/studio-sdk.',
            },
          ],
        },
      ],
    },
  },
  // Tests: async render/mocks are idiomatic even without an `await`, and a test
  // asserting on a known-good fixture may index/non-null-assert into it.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
    },
  },
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
      },
    },
  },
);
