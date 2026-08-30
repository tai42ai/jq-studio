/**
 * Lazily install jq-studio's DEFAULT jq-evaluation worker factory.
 *
 * jq-web runs synchronously, so a non-terminating expression would freeze the
 * tab; jq-studio evaluates jq inside a Web Worker it can `terminate()` on a
 * deadline (see `jq-worker-client.ts`). The one static
 * `new Worker(new URL('./jq-eval.worker.ts', import.meta.url), { type: 'module' })`
 * lives HERE, so the library build emits the worker as a real, same-origin ES
 * module file next to the other chunks (served under `script-src 'self'`).
 *
 * A host that owns worker construction (its own CSP, its own bundler) can skip
 * this and call `setJqWorkerFactory` itself; a host with no worker support at all
 * gets the documented main-thread fallback, because the factory returns `null`
 * (and any construction throw is caught) rather than breaking the editor.
 *
 * Idempotent: the drop-in `JqField` calls it on mount, and calling it more than
 * once is a no-op.
 */
import { setJqWorkerFactory } from './jq-worker-client';

let installed = false;

export function installDefaultJqWorker(): void {
  if (installed) return;
  installed = true;
  setJqWorkerFactory(() => {
    try {
      return new Worker(new URL('./jq-eval.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      // No Worker support (or a CSP that forbids this one): fall back to
      // synchronous main-thread evaluation, preserving the editor's behaviour.
      return null;
    }
  });
}
