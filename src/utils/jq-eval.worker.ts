/**
 * The jq evaluation Web Worker.
 *
 * Emitted as a REAL, same-origin file by the library build (see `scripts/build.mjs`
 * `worker` config). The documented deployment CSP (see `docs/worker-csp.md`) is
 * `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'`.
 * A same-origin worker FILE ('self') is therefore allowed, a blob:/inline worker is
 * BLOCKED, and the `'wasm-unsafe-eval'` token lets jq-web instantiate its
 * WebAssembly INSIDE the worker. This module is thus fetched by URL from the served
 * `dist/` chunks — never a blob URL — which is exactly what that CSP permits.
 *
 * It runs jq-web SYNCHRONOUSLY, so a non-terminating program (`def f: f; f`,
 * `until(false; .)`) blocks THIS worker thread — not the tab. The main-thread
 * client owns the deadline: when its timer fires it `terminate()`s this worker
 * and reconstructs a fresh one for the next request. The worker itself needs no
 * timeout logic; it only answers what it can.
 *
 * `jq.wasm` is resolved via jq-loader's `new URL('jq.wasm', import.meta.url)`,
 * i.e. relative to THIS worker file's served URL — the same single `jq.wasm` the
 * bundle emits, fetched same-origin.
 */
import { runJq, runJqValue } from './jq-loader';
import type { JqWorkerRequest, JqWorkerResponse } from './jq-worker-protocol';

/** The dedicated-worker global surface this file uses. Declared locally rather than
 *  pulled from the `WebWorker` lib, which would collide with the program's `DOM`
 *  lib (both declare `self` / `postMessage` / `MessageEvent`). */
interface JqWorkerScope {
  postMessage(message: JqWorkerResponse): void;
  onmessage: ((event: MessageEvent<JqWorkerRequest>) => void) | null;
}

const scope = globalThis as unknown as JqWorkerScope;

function post(message: JqWorkerResponse): void {
  scope.postMessage(message);
}

async function handle(req: JqWorkerRequest): Promise<void> {
  if (req.kind === 'runJq') {
    const result = await runJq(req.expression, req.jsonInput);
    post({ id: req.id, kind: 'runJq', result });
    return;
  }
  // runJqValue: the oracle needs the thrown jq error told apart from a value, so
  // an error is reported as `{ ok: false, error }` rather than a rejection.
  try {
    const value = await runJqValue(req.program, req.input);
    post({ id: req.id, kind: 'runJqValue', ok: true, value });
  } catch (err) {
    post({
      id: req.id,
      kind: 'runJqValue',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

scope.onmessage = (event) => {
  void handle(event.data);
};
