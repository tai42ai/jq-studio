# Worker & CSP deployment

jq-web runs **synchronously**, so a non-terminating expression (`def f: f; f`,
`until(false; .)`) would freeze the tab: there is no cooperative yield to interrupt
it. jq-studio therefore evaluates jq inside a **Web Worker** it can `terminate()`
on a deadline. This page covers serving that worker and its WASM under a Content
Security Policy, and the fallback when no worker is available.

## What the build emits

`pnpm build` (and the published package) puts these in `dist/`, alongside the
library entry:

- `dist/jq-studio-worker-*.js` — the jq-evaluation worker, a real ES module file.
- `dist/jq.wasm` — jq-web's WebAssembly module.

Both are referenced by **relative URL** (`new URL('…', import.meta.url)`), so they
resolve against the served chunk, not your origin root. Ship the whole `dist/`
directory from your own origin — do not rewrite these to absolute paths.

## Serve from your own origin

The worker is loaded as a same-origin **file** (never a `blob:` or inline worker),
because that is what a strict CSP permits. A typical policy:

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self';
connect-src 'self';
```

- `script-src 'self'` (or `worker-src 'self'`) allows the worker **file** to load.
  A `blob:`/inline worker would need `blob:` in the policy; jq-studio does not use
  one.
- `'wasm-unsafe-eval'` lets jq-web instantiate its WASM (in the worker and, on the
  fallback path, on the main thread). Without it, WASM compilation is blocked.
- No `connect-src` to a third party is needed: `jq.wasm` is same-origin, resolved
  by relative URL and read via `locateFile`. jq-studio makes no network calls of
  its own.

If your CSP omits `worker-src`, browsers fall back to `script-src`, so `'self'`
still allows the worker file.

## Main-thread fallback

Where a worker cannot be constructed — an older host, or a CSP that forbids this
one — jq-studio falls back to **synchronous main-thread evaluation**, preserving
the editor's behaviour. In that mode there is no runtime deadline, so a runaway
expression can block the tab until the host serves the worker file; that is the
documented trade-off, not a failure.

## Wiring the worker

- `JqField` installs the default worker on mount — nothing to do.
- Using `JqEditorDialog` (or the converters/guard) directly? Call
  `installDefaultJqWorker()` once at startup.
- Own bundler or CSP? Provide your own factory:

  ```ts
  import { setJqWorkerFactory } from '@tai42/jq-studio';

  setJqWorkerFactory(
    () =>
      new Worker(new URL('./my-jq-worker.js', import.meta.url), {
        type: 'module',
      }),
  );
  // return null from the factory to force the main-thread fallback
  ```

`installDefaultJqWorker()` is idempotent; the last `setJqWorkerFactory` wins.

## Bundler notes

The published `dist` is plain ESM. Bundlers that honour `new URL(…,
import.meta.url)` (Vite, modern webpack, Rollup) emit the worker and wasm as
assets automatically. Ensure your bundler copies `dist/jq.wasm` and the worker
file to your served output and does not rewrite their relative URLs to absolute
origin-root paths.
