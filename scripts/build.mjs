/**
 * Build `@tai42/jq-studio` as a plain ES-module library. Run as `pnpm build`.
 *
 *   dist/index.js         the library entry (ESM)
 *   dist/*.worker-*.js    the jq-evaluation Web Worker, emitted as a real file
 *   dist/jq.wasm          jq-web's WebAssembly module (one copy, resolved relative)
 *   dist/styles.css       the single stylesheet (theme + editor + primitives)
 *   dist/*.d.ts           types, emitted by `tsc` (tsconfig.build.json)
 *   dist/NOTICE           attribution for the bundled jq-web / jq.wasm
 *   dist/THIRD-PARTY-LICENSES  the full jq-web license text, verbatim
 *
 * NO python, NO wheel, NO CSS rescope machinery: the editor's CSS is authored
 * under one fixed root class (`.jq-studio-root`) and shipped as-is. React, React
 * DOM, and every runtime dependency (React Flow, Radix, lucide, clsx) are EXTERNAL
 * so the consumer resolves a single copy of each; jq-web is BUNDLED (its patched
 * factory is baked in) and its `jq.wasm` copied beside the chunks, so a consumer
 * needs neither the pnpm patch nor a jq-web install.
 *
 * Assertions gate the emit: no `@tai42/studio-sdk` string may survive into any
 * chunk (the design-system independence guarantee), every intra-bundle asset URL —
 * the worker above all — must be RELATIVE so it resolves against the served chunk
 * rather than the consumer's origin root, and the bundled jq.wasm must never ship
 * without its NOTICE and THIRD-PARTY-LICENSES attribution.
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const srcDir = resolve(repoRoot, 'src');
const outDir = resolve(repoRoot, 'dist');

/** Bare specifiers left for the consumer to resolve (a single shared copy each).
 *  Everything else in the graph is bundled; jq-web is deliberately NOT here. */
const EXTERNAL = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom/client',
  '@xyflow/react',
  'lucide-react',
  'clsx',
];

function isExternal(id) {
  if (EXTERNAL.includes(id)) return true;
  return id.startsWith('@radix-ui/');
}

async function main() {
  process.env.NODE_ENV = 'production';
  rmSync(outDir, { recursive: true, force: true });

  await build({
    root: repoRoot,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    // Emit every Vite-managed asset URL (the worker) relative to the importing
    // chunk, so it resolves against the served file rather than the origin root.
    base: './',
    plugins: [react()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    worker: {
      format: 'es',
      rollupOptions: {
        external: isExternal,
        output: {
          entryFileNames: 'jq-studio-worker-[hash].js',
          inlineDynamicImports: true,
        },
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      minify: false,
      cssCodeSplit: false,
      modulePreload: { polyfill: false },
      sourcemap: true,
      lib: {
        entry: resolve(srcDir, 'index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
        external: isExternal,
        output: {
          entryFileNames: 'index.js',
          chunkFileNames: 'jq-studio-[name]-[hash].js',
          assetFileNames: (asset) => {
            const name = asset.names?.[0] ?? asset.name ?? '';
            if (name.endsWith('.css')) return 'styles.css';
            if (name.endsWith('.wasm')) return 'jq.wasm';
            return 'jq-studio-[name]-[hash][extname]';
          },
        },
      },
    },
  });

  // Ship jq-web's WebAssembly module beside the chunks. The loader and the worker
  // both resolve it via `new URL('jq.wasm', import.meta.url)`, so the name is fixed.
  const wasmSource = resolve(repoRoot, 'node_modules', 'jq-web', 'jq.wasm');
  if (!existsSync(wasmSource)) {
    throw new Error(`jq-web wasm not found at ${wasmSource} — run pnpm install`);
  }
  copyFileSync(wasmSource, resolve(outDir, 'jq.wasm'));

  // Ship the third-party attribution beside the artifact: the bundled jq.wasm and
  // jq-web glue must never travel without their NOTICE and full license text.
  for (const file of ['NOTICE', 'THIRD-PARTY-LICENSES']) {
    const source = resolve(repoRoot, file);
    if (!existsSync(source)) {
      throw new Error(`${file} not found at ${source} — required to attribute bundled jq-web`);
    }
    copyFileSync(source, resolve(outDir, file));
  }

  // Types (declaration-only) via the repo toolchain's tsc.
  execFileSync('tsc', ['-p', resolve(repoRoot, 'tsconfig.build.json')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  assertEmit();
}

/** Post-build gates: independence (no SDK string), relative self-asset URLs, and
 *  the bundled-wasm attribution files. */
function assertEmit() {
  const jsFiles = readdirSync(outDir).filter((name) => name.endsWith('.js'));
  const workers = jsFiles.filter((name) => name.includes('-worker-'));
  const violations = [];

  if (!existsSync(resolve(outDir, 'index.js'))) violations.push('missing dist/index.js');
  if (!existsSync(resolve(outDir, 'index.d.ts'))) violations.push('missing dist/index.d.ts');
  if (!existsSync(resolve(outDir, 'styles.css'))) violations.push('missing dist/styles.css');
  if (!existsSync(resolve(outDir, 'jq.wasm'))) violations.push('missing dist/jq.wasm');
  // The bundled jq-web wasm must ship with its attribution.
  if (!existsSync(resolve(outDir, 'NOTICE'))) violations.push('missing dist/NOTICE');
  if (!existsSync(resolve(outDir, 'THIRD-PARTY-LICENSES'))) {
    violations.push('missing dist/THIRD-PARTY-LICENSES');
  }
  if (workers.length !== 1) {
    violations.push(`expected exactly one emitted worker file, got ${workers.length}`);
  }

  for (const name of jsFiles) {
    const js = readFileSync(resolve(outDir, name), 'utf8');
    if (js.includes('@tai42/studio-sdk')) {
      violations.push(`emitted JS references @tai42/studio-sdk: ${name}`);
    }
    // A root-absolute "/jq-studio-…" or "/jq.wasm" self-asset URL would resolve
    // against the consumer's origin root instead of the served chunk.
    if (/["'`]\/(?:jq-studio-|jq\.wasm)/.test(js)) {
      violations.push(`emitted JS carries a root-absolute self-asset URL: ${name}`);
    }
  }

  if (violations.length > 0) {
    throw new Error('build assertion failed:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  }

  const sha = (file) =>
    'sha256-' +
    createHash('sha256')
      .update(readFileSync(resolve(outDir, file)))
      .digest('base64');
  const topLevelFiles = readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.endsWith('.map'))
    .map((e) => e.name)
    .sort();
  console.log(
    'jq-studio library built (top-level artifacts):\n' +
      topLevelFiles.map((n) => `  ${n}  ${sha(n).slice(0, 24)}…`).join('\n'),
  );
}

await main();
