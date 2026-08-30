import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the standalone jq-studio package: a jsdom DOM environment +
 * React Testing Library, so the canvas, editor dialog, drop-in field and node
 * components are exercised as real rendered DOM, and the converters /
 * faithfulness guard / corpus run against the jq-web WASM runtime.
 *
 * `resolve.dedupe` binds ONE React across the tests and the Radix primitives the
 * built-in components render through — the test-time mirror of the singleton a
 * host import map guarantees in the browser.
 *
 * Coverage (v8) runs on `pnpm test:coverage`; the thresholds are a real gate,
 * each a couple of points under what the suite achieves so one newly uncovered
 * branch does not break the run while losing a module's tests does.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    mainFields: ['module', 'browser', 'jsnext:main', 'jsnext'],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./src/test-setup.ts'],
    // The Playwright suite under e2e/ is a separate project, run by Playwright.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    server: {
      deps: {
        // Route the Radix internals through vite so `resolve.dedupe` binds the
        // single React copy above — externalized they would pull a second one and
        // crash every hook.
        inline: [
          /@radix-ui\//,
          /@floating-ui\//,
          /react-remove-scroll/,
          /react-style-singleton/,
          /use-callback-ref/,
          /use-sidecar/,
          /aria-hidden/,
        ],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/**/*.d.ts'],
      reporter: ['text'],
      thresholds: {
        statements: 78,
        branches: 80,
        functions: 80,
        lines: 78,
      },
    },
  },
});
