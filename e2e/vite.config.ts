import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * A bare consumer app. It imports `@tai42/jq-studio` exactly as an npm consumer
 * would — the surface and its `styles.css` — but resolves the specifier to the
 * repo's BUILT `dist` (aliased below) rather than a published tarball, so the e2e
 * exercises the artifact the release actually ships. `dedupe` binds one React (and
 * one React Flow) across the app and the aliased package, the browser-runtime
 * mirror of the single copy an npm install would resolve.
 */
const here = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(here, '..', 'dist');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tai42/jq-studio/styles.css': resolve(dist, 'styles.css'),
      '@tai42/jq-studio': resolve(dist, 'index.js'),
    },
    dedupe: ['react', 'react-dom', '@xyflow/react'],
  },
  optimizeDeps: {
    // The aliased dist references its worker + wasm by relative URL; let Vite serve
    // them as-is instead of pre-bundling the entry.
    exclude: ['@tai42/jq-studio'],
  },
  // The built dist lives one level up (outside this app's root); allow Vite to
  // serve it and its sibling worker + wasm assets.
  server: { port: 4321, strictPort: true, fs: { allow: [resolve(here, '..')] } },
  preview: { port: 4321, strictPort: true },
});
