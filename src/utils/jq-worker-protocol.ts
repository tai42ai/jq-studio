/**
 * The message protocol between the main thread and the jq evaluation worker.
 *
 * The worker runs jq-web SYNCHRONOUSLY (see jq-loader), so a runaway program with
 * no output freezes the WORKER thread, not the tab — the main thread stays free to
 * fire a deadline timer and `terminate()` the stuck worker. Every message carries
 * an `id` so a response is matched to its request; the client keys its pending map
 * and its per-request deadline timers by that id.
 */
import type { JqResult } from './jq-loader';

/** A request to evaluate a jq expression against a JSON input STRING, mirroring
 *  {@link runJq} — the Test panel's Run action. */
export interface RunJqRequest {
  readonly id: number;
  readonly kind: 'runJq';
  readonly expression: string;
  readonly jsonInput: string;
}

/** A request to run a jq program against an already-parsed input VALUE, mirroring
 *  {@link runJqValue} — the executor the faithfulness oracle battery drives. */
export interface RunJqValueRequest {
  readonly id: number;
  readonly kind: 'runJqValue';
  readonly program: string;
  readonly input: unknown;
}

export type JqWorkerRequest = RunJqRequest | RunJqValueRequest;

/** The worker builds the whole {@link JqResult} for a runJq request. */
export interface RunJqResponse {
  readonly id: number;
  readonly kind: 'runJq';
  readonly result: JqResult;
}

/** A runJqValue response: the program's value, or the jq error it threw. The
 *  oracle needs the error/no-error distinction, so it is carried explicitly
 *  rather than collapsed into a result field. */
export type RunJqValueResponse =
  | { readonly id: number; readonly kind: 'runJqValue'; readonly ok: true; readonly value: unknown }
  | {
      readonly id: number;
      readonly kind: 'runJqValue';
      readonly ok: false;
      readonly error: string;
    };

export type JqWorkerResponse = RunJqResponse | RunJqValueResponse;
