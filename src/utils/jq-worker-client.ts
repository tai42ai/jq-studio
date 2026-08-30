/**
 * The main-thread client for the jq evaluation {@link file://./jq-eval.worker.ts}.
 *
 * WHY A WORKER. jq-web runs SYNCHRONOUSLY: a non-terminating program with no
 * output freezes whatever thread evaluates it. Off the main thread, a runaway
 * only blocks the worker, and THIS client — free on the main thread — enforces a
 * deadline by `terminate()`ing the stuck worker and reconstructing a fresh one for
 * the next request. That is the deferred-freeze fix (see jq-loader's KNOWN
 * LIMITATION note), now CSP-feasible because the worker is a same-origin FILE.
 *
 * DEADLINES. `runJqExpr` (the Test panel's Run) gets a generous whole-run
 * deadline; `runJqValueDeadline` (the faithfulness oracle's per-input executor)
 * gets a shorter one, so the oracle battery cannot hang the guard. A timed-out run
 * surfaces as a clear "timed out" JqResult; a timed-out oracle input throws
 * {@link JqTimeoutError} so the oracle treats it as UNKNOWN-and-unfaithful, never
 * silently equal (see faithfulness `runSample`).
 *
 * FALLBACK. The worker is OPT-IN: it evaluates through the worker only once a
 * factory has been injected via {@link setJqWorkerFactory}. With no factory —
 * the library's default before {@link installDefaultJqWorker} runs, and every
 * test — every call runs on the main thread exactly as before. If a factory IS
 * set but the worker fails to CONSTRUCT (no Worker support, blocked by CSP), the
 * client logs once and falls back to the main thread too, preserving today's
 * behavior rather than breaking the panel.
 */
import { runJq as mainRunJq, runJqValue as mainRunJqValue, type JqResult } from './jq-loader';
import type { JqWorkerRequest, JqWorkerResponse } from './jq-worker-protocol';

/** The whole-run deadline for the Test panel's Run action. */
export const TEST_DEADLINE_MS = 5000;

/** The shorter per-input deadline the faithfulness oracle battery runs under: a
 *  single sample input must not take this long, so exceeding it means a runaway. */
export const ORACLE_INPUT_DEADLINE_MS = 1500;

/** The message shown in the Test panel when a run is stopped at its deadline. */
export const TIMEOUT_MESSAGE =
  'The expression timed out and was stopped. It may not terminate on this input ' +
  '(for example an unbounded recursion). Simplify it and try again.';

/**
 * Thrown by {@link JqWorkerClient.runJqValueDeadline} when an oracle input is
 * stopped at its deadline. It is DISTINCT from an ordinary jq error on purpose:
 * the faithfulness oracle counts two ordinary errors as agreement, but a timeout
 * is "we could not decide", which must never read as faithful.
 */
export class JqTimeoutError extends Error {
  constructor(message = 'jq evaluation timed out') {
    super(message);
    this.name = 'JqTimeoutError';
  }
}

/** A factory a caller injects, holding the ONE static
 *  `new Worker(new URL('./jq-eval.worker.ts', import.meta.url), { type: 'module' })`
 *  call so the library build emits the worker as a real file (see
 *  {@link ./install-default-worker.ts}); a consumer that owns worker construction
 *  can supply its own factory instead.
 *  Returns `null` when a worker cannot be constructed (no Worker support). */
export type JqWorkerFactory = () => Worker | null;

interface PendingEntry {
  timer: ReturnType<typeof setTimeout>;
  /** Resolve/reject from the worker's response for this id. */
  onMessage: (response: JqWorkerResponse) => void;
  /** The deadline fired: settle this request as a timeout. */
  onTimeout: () => void;
  /** The whole worker failed at runtime: re-run this request on the main thread. */
  onWorkerError: () => void;
}

class JqWorkerClient {
  private factory: JqWorkerFactory | null = null;
  /** `undefined` = not yet constructed; `null` = construction failed (fallback);
   *  a `Worker` = live. */
  private worker: Worker | null | undefined = undefined;
  private warnedFallback = false;
  private seq = 0;
  private readonly pending = new Map<number, PendingEntry>();

  setFactory(factory: JqWorkerFactory | null): void {
    this.factory = factory;
    // A new (or cleared) factory invalidates any existing worker + in-flight work.
    this.reset();
    this.warnedFallback = false;
  }

  /** For tests: drop the worker and any pending state without touching the factory. */
  reset(): void {
    for (const [, entry] of this.pending) clearTimeout(entry.timer);
    this.pending.clear();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = undefined;
  }

  /** Construct the worker on first use; memoize success and failure alike. The
   *  factory owns environment support — it returns `null` (or throws, caught here)
   *  when `Worker` is unavailable — so no separate `typeof Worker` guard is needed. */
  private ensureWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    if (!this.factory) {
      this.worker = null;
      return null;
    }
    let created: Worker | null = null;
    try {
      created = this.factory();
    } catch (err) {
      this.noteFallback(err);
      this.worker = null;
      return null;
    }
    if (!created) {
      this.worker = null;
      return null;
    }
    created.onmessage = (event: MessageEvent<JqWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    created.onerror = (event) => {
      this.handleWorkerError(event);
    };
    this.worker = created;
    return created;
  }

  private noteFallback(err: unknown): void {
    if (this.warnedFallback) return;
    this.warnedFallback = true;
    console.warn(
      'jq worker unavailable — falling back to main-thread evaluation (no runtime ' +
        'deadline). A runaway expression can freeze the tab until this host serves ' +
        'the worker file.',
      err,
    );
  }

  private handleMessage(response: JqWorkerResponse): void {
    const entry = this.pending.get(response.id);
    if (!entry) return; // already timed out / terminated
    clearTimeout(entry.timer);
    this.pending.delete(response.id);
    entry.onMessage(response);
  }

  /** A deadline fired for one request. The worker is single-threaded, so a runaway
   *  blocks EVERY in-flight request: terminate it and time them all out together,
   *  then drop the worker so the next call constructs a fresh one. */
  private handleDeadline(): void {
    const entries = [...this.pending.values()];
    this.pending.clear();
    this.dropWorker();
    for (const entry of entries) {
      clearTimeout(entry.timer);
      entry.onTimeout();
    }
  }

  /** The worker emitted a runtime error event. Re-run every pending request on the
   *  main thread so the surface keeps working, and drop the worker. */
  private handleWorkerError(event: ErrorEvent | Event): void {
    this.noteFallback(event instanceof ErrorEvent ? event.message : event);
    const entries = [...this.pending.values()];
    this.pending.clear();
    this.dropWorker();
    // A worker that errors once is treated as broken for the rest of the session:
    // pin the fallback so subsequent calls skip construction.
    this.worker = null;
    for (const entry of entries) {
      clearTimeout(entry.timer);
      entry.onWorkerError();
    }
  }

  private dropWorker(): void {
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = undefined;
  }

  private nextId(): number {
    return ++this.seq;
  }

  private send(request: JqWorkerRequest, worker: Worker): void {
    worker.postMessage(request);
  }

  /** Run a jq expression against a JSON input string, with a whole-run deadline.
   *  On timeout, resolves a failed {@link JqResult} carrying {@link TIMEOUT_MESSAGE}
   *  (never rejects — the Test panel renders the message). */
  async runJqExpr(
    expression: string,
    jsonInput: string,
    deadlineMs: number = TEST_DEADLINE_MS,
  ): Promise<JqResult> {
    const worker = this.ensureWorker();
    if (!worker) return mainRunJq(expression, jsonInput);

    const start = performance.now();
    const id = this.nextId();
    return new Promise<JqResult>((resolve) => {
      const timer = setTimeout(() => {
        this.handleDeadline();
      }, deadlineMs);
      this.pending.set(id, {
        timer,
        onMessage: (response) => {
          if (response.kind === 'runJq') resolve(response.result);
        },
        onTimeout: () => {
          resolve({
            success: false,
            output: '',
            error: TIMEOUT_MESSAGE,
            timedOut: true,
            durationMs: performance.now() - start,
          });
        },
        onWorkerError: () => {
          void mainRunJq(expression, jsonInput).then(resolve);
        },
      });
      this.send({ id, kind: 'runJq', expression, jsonInput }, worker);
    });
  }

  /** Run a jq program against a parsed input value, with a per-input deadline.
   *  Resolves the value, rejects with the jq error on a jq failure, and rejects
   *  with {@link JqTimeoutError} on a deadline — the executor the oracle drives. */
  async runJqValueDeadline(
    program: string,
    input: unknown,
    deadlineMs: number = ORACLE_INPUT_DEADLINE_MS,
  ): Promise<unknown> {
    const worker = this.ensureWorker();
    if (!worker) return mainRunJqValue(program, input);

    const id = this.nextId();
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handleDeadline();
      }, deadlineMs);
      this.pending.set(id, {
        timer,
        onMessage: (response) => {
          if (response.kind !== 'runJqValue') return;
          if (response.ok) resolve(response.value);
          else reject(new Error(response.error));
        },
        onTimeout: () => {
          reject(new JqTimeoutError());
        },
        onWorkerError: () => {
          mainRunJqValue(program, input).then(resolve, reject);
        },
      });
      this.send({ id, kind: 'runJqValue', program, input }, worker);
    });
  }
}

/** The process-wide client. A singleton so the worker (and its jq-web instance) is
 *  constructed once and reused across the Test panel and the faithfulness guard. */
const client = new JqWorkerClient();

/** Injects the worker factory (see {@link ./install-default-worker.ts} for the
 *  library's default, or supply your own). Passing `null` clears it and reverts
 *  every call to main-thread evaluation. */
export function setJqWorkerFactory(factory: JqWorkerFactory | null): void {
  client.setFactory(factory);
}

/** Test-only: drop the worker + pending state (keeps any injected factory). */
export function resetJqWorkerClientForTests(): void {
  client.reset();
}

export function runJqViaWorker(
  expression: string,
  jsonInput: string,
  deadlineMs?: number,
): Promise<JqResult> {
  return client.runJqExpr(expression, jsonInput, deadlineMs);
}

export function runJqValueViaWorker(
  program: string,
  input: unknown,
  deadlineMs?: number,
): Promise<unknown> {
  return client.runJqValueDeadline(program, input, deadlineMs);
}
