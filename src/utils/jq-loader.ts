/**
 * jq expression runner backed by the jq-web WASM module.
 *
 * The module is loaded lazily on first use and memoized, so the WASM binary is
 * fetched and instantiated once. `locateFile` resolves `jq.wasm` relative to
 * this bundle's URL, so it points at the served `dist/jq.wasm` beside the library
 * chunks rather than the page root.
 *
 * RUNTIME DEADLINE — off-thread, terminate-on-deadline. jq-web runs
 * SYNCHRONOUSLY on the calling thread, so a non-terminating program with no
 * output (`def f: f; f`, `until(false; .)`) freezes whatever thread evaluates it:
 * there is no cooperative yield to interrupt. `limit()` (the faithfulness
 * oracle's `wrapProgram`) bounds an unbounded OUTPUT stream but not runtime, and a
 * static "will it terminate" pre-check is unsound (it would reject valid bounded
 * uses of `repeat` / `while`). The correct fix — now SHIPPED — is to evaluate
 * inside a Web Worker and `terminate()` it on a deadline (see jq-eval.worker.ts +
 * jq-worker-client.ts). It is CSP-feasible because the library build emits the
 * worker as a REAL, same-origin FILE (never a blob:/inline worker): the documented
 * deployment CSP (see `docs/worker-csp.md`)
 * `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'`
 * allows a `'self'` worker file and `'wasm-unsafe-eval'` lets jq-web instantiate
 * its WASM inside it.
 *
 * The functions in THIS module remain the synchronous main-thread engine. They
 * are what the worker runs (the worker imports them), and they are also the
 * documented FALLBACK the client uses when no worker is available (before
 * `installDefaultJqWorker` runs, and in tests) or when construction fails on a host
 * without Worker support — in which case today's freeze risk stands, by design,
 * rather than breaking the panel.
 */
import type { JqModule } from 'jq-web';

export interface JqResult {
  success: boolean;
  output: string;
  error?: string;
  /** Set when the run was stopped at its deadline (worker terminated) rather than
   *  completing or erroring in jq — the Test panel copies this apart from a jq
   *  error. Absent on a normal main-thread run, which has no deadline. */
  timedOut?: boolean;
  durationMs: number;
}

let jqPromise: Promise<JqModule> | null = null;

function getJq(): Promise<JqModule> {
  if (jqPromise) return jqPromise;
  const p = import('jq-web')
    .then((mod) => mod.factory({ locateFile: () => new URL('jq.wasm', import.meta.url).href }))
    .catch((err: unknown) => {
      // Never memoize a REJECTED load — clear the memo so the next open retries a
      // fresh instantiation. The failure still propagates to this caller (it is
      // re-thrown) and surfaces loudly in `runJq`.
      if (jqPromise === p) jqPromise = null;
      throw err;
    });
  jqPromise = p;
  return p;
}

/** Kick off loading the WASM module ahead of the first run (e.g. on dialog open).
 *  Preload is best-effort: a failure here is logged once and swallowed (a cleared
 *  memo means the real `runJq` load path retries and surfaces the error loudly). */
export function preloadJq(): void {
  getJq().catch((err: unknown) => {
    console.warn('jq preload failed; the module will be retried on first use', err);
  });
}

/**
 * Whether a jq expression is well-formed jq (it compiles), told apart from
 * whether the visual editor can draw it. The two are independent: plenty of
 * valid jq uses shapes the node graph has no faithful form for, and that is not
 * an error in the expression.
 */
export type JqValidity = 'valid' | 'invalid';

/**
 * Compile-checks a jq expression through the WASM runtime, independent of any
 * input. jq compiles the whole program before it runs a single value, so a
 * malformed program fails on the same "compile error" line no matter the input,
 * while a well-formed one either yields a value or fails at RUNTIME — and a
 * runtime failure still means the jq itself is valid. The program is therefore
 * run against `null` purely to reach the compiler, and only a compile-time
 * failure counts as invalid.
 *
 * Best-effort by design: an empty expression is treated as valid (nothing to
 * reject), and a runtime that cannot even load is reported as `valid` too — the
 * check may not have PROVEN validity, but it has not disproven it, so the caller
 * must not raise a false "invalid" on a runtime-load failure.
 */
export async function checkJqValidity(expression: string): Promise<JqValidity> {
  if (!expression.trim()) return 'valid';
  let jq: JqModule;
  try {
    jq = await getJq();
  } catch {
    // The runtime could not load: we cannot disprove validity, so do not cry wolf.
    return 'valid';
  }
  try {
    jq.json(null, expression);
    return 'valid';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A compile failure is jq rejecting the program text itself; a runtime error
    // (e.g. "Cannot iterate over null") is the program running and means valid jq.
    return /compile error|syntax error/i.test(message) ? 'invalid' : 'valid';
  }
}

/**
 * Runs a jq program against an already-parsed input value, resolving to the
 * program's output or REJECTING on a jq error (compile or runtime).
 *
 * This is the executor the faithfulness oracle drives: unlike {@link runJq},
 * which reports failure in a result field, the oracle needs the thrown error so
 * it can tell an erroring program apart from a succeeding one (two programs that
 * both error on an input agree there).
 */
export async function runJqValue(program: string, input: unknown): Promise<unknown> {
  const jq = await getJq();
  return jq.json(input, program);
}

/** Run a jq expression against a JSON input string, returning a structured result. */
export async function runJq(expression: string, jsonInput: string): Promise<JqResult> {
  const start = performance.now();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch {
    return {
      success: false,
      output: '',
      error: 'Invalid JSON input',
      durationMs: performance.now() - start,
    };
  }

  // The WASM engine load and the program evaluation are DISTINCT failures with
  // distinct copy: a load failure is an environment problem the raw emscripten
  // error only obscures, while an evaluation error is the user's own jq and must
  // be shown verbatim.
  let jq: JqModule;
  try {
    jq = await getJq();
  } catch {
    return {
      success: false,
      output: '',
      error:
        'The jq engine could not load. Check your connection and reopen the editor to try again.',
      durationMs: performance.now() - start,
    };
  }

  try {
    const result = jq.json(parsed, expression);
    const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return {
      success: true,
      output,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: '',
      error: message,
      durationMs: performance.now() - start,
    };
  }
}
