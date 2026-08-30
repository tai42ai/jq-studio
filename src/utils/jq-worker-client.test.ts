/**
 * The jq worker client: deadline-terminate, worker↔main-thread fallback, and the
 * timeout semantics the faithfulness oracle depends on.
 *
 * A `FakeWorker` stands in for a real dedicated worker: the client posts to it and
 * the test drives the response (or withholds one, to exercise a deadline). The
 * FALLBACK cases use no worker and run jq-web on the main thread for real — proving
 * the client degrades to today's behaviour when no worker is available.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// The main-thread FALLBACK path calls jq-loader's runJq/runJqValue. Those resolve
// `jq.wasm` relative to the browser bundle, which the node/jsdom test host lacks,
// so mock them with deterministic fakes — this suite tests the CLIENT (deadline,
// dispatch, fallback), not the WASM runtime (covered by the jq-loader suites).
const { mainRunJq, mainRunJqValue } = vi.hoisted(() => ({
  mainRunJq: vi.fn(async (expression: string, jsonInput: string) => ({
    success: true,
    output: `main:${expression}:${jsonInput}`,
    durationMs: 0,
  })),
  mainRunJqValue: vi.fn(async (program: string, input: unknown) => ({ program, input })),
}));
vi.mock('./jq-loader', () => ({ runJq: mainRunJq, runJqValue: mainRunJqValue }));

import {
  JqTimeoutError,
  TIMEOUT_MESSAGE,
  runJqValueViaWorker,
  runJqViaWorker,
  setJqWorkerFactory,
} from './jq-worker-client';
import type { JqWorkerRequest, JqWorkerResponse } from './jq-worker-protocol';

class FakeWorker {
  onmessage: ((event: MessageEvent<JqWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent | Event) => void) | null = null;
  terminated = false;
  posted: JqWorkerRequest[] = [];
  responder: ((req: JqWorkerRequest) => void) | null = null;

  postMessage(req: JqWorkerRequest): void {
    this.posted.push(req);
    this.responder?.(req);
  }
  terminate(): void {
    this.terminated = true;
  }
  respond(res: JqWorkerResponse): void {
    this.onmessage?.({ data: res } as MessageEvent<JqWorkerResponse>);
  }
  emitError(message: string): void {
    this.onerror?.(new ErrorEvent('error', { message }));
  }
}

afterEach(() => {
  // Clears the singleton's worker + pending state and drops the factory, so the
  // next test starts from the main-thread-fallback default.
  setJqWorkerFactory(null);
});

describe('jq worker client — fallback (no worker)', () => {
  it('runs runJq on the main thread when no factory is set', async () => {
    const res = await runJqViaWorker('.a', '{"a":5}');
    expect(res.success).toBe(true);
    expect(res.output).toBe('main:.a:{"a":5}');
    expect(mainRunJq).toHaveBeenCalledWith('.a', '{"a":5}');
  });

  it('runs runJqValue on the main thread when the factory returns null', async () => {
    setJqWorkerFactory(() => null);
    const value = await runJqValueViaWorker('.a', { a: 3 });
    expect(value).toEqual({ program: '.a', input: { a: 3 } });
  });

  it('warns once and falls back when the factory throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setJqWorkerFactory(() => {
      throw new Error('boom');
    });
    const res = await runJqViaWorker('.a', '{"a":1}');
    expect(res.output).toBe('main:.a:{"a":1}');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('jq worker client — worker path', () => {
  it('resolves a runJq result the worker returns', async () => {
    const fake = new FakeWorker();
    fake.responder = (req) => {
      if (req.kind === 'runJq') {
        fake.respond({
          id: req.id,
          kind: 'runJq',
          result: { success: true, output: '42', durationMs: 1 },
        });
      }
    };
    setJqWorkerFactory(() => fake as unknown as Worker);
    const res = await runJqViaWorker('.x', '{}');
    expect(res).toEqual({ success: true, output: '42', durationMs: 1 });
    expect(fake.terminated).toBe(false);
  });

  it('resolves a runJqValue value the worker returns', async () => {
    const fake = new FakeWorker();
    fake.responder = (req) => {
      if (req.kind === 'runJqValue') {
        fake.respond({ id: req.id, kind: 'runJqValue', ok: true, value: 7 });
      }
    };
    setJqWorkerFactory(() => fake as unknown as Worker);
    await expect(runJqValueViaWorker('.n', null)).resolves.toBe(7);
  });

  it('rejects runJqValue with a plain Error (NOT a timeout) on a jq error', async () => {
    const fake = new FakeWorker();
    fake.responder = (req) => {
      if (req.kind === 'runJqValue') {
        fake.respond({ id: req.id, kind: 'runJqValue', ok: false, error: 'jq: syntax error' });
      }
    };
    setJqWorkerFactory(() => fake as unknown as Worker);
    await expect(runJqValueViaWorker('.(', null)).rejects.toMatchObject({
      message: 'jq: syntax error',
    });
    // A jq error must be an ordinary Error so the oracle counts it as agreement
    // between two identically-erroring programs — never a timeout.
    const err = await runJqValueViaWorker('.(', null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(JqTimeoutError);
  });
});

describe('jq worker client — deadline terminate', () => {
  it('terminates a runaway runJq at the deadline and surfaces a timeout result', async () => {
    const fake = new FakeWorker();
    fake.responder = () => {
      /* never responds — simulates a synchronous runaway blocking the worker */
    };
    setJqWorkerFactory(() => fake as unknown as Worker);
    const res = await runJqViaWorker('def f: f; f', '{}', 15);
    expect(res.success).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.error).toBe(TIMEOUT_MESSAGE);
    // The stuck worker was killed so the next request constructs a fresh one.
    expect(fake.terminated).toBe(true);
  });

  it('rejects a runaway runJqValue with JqTimeoutError at the deadline', async () => {
    const fake = new FakeWorker();
    fake.responder = () => {};
    setJqWorkerFactory(() => fake as unknown as Worker);
    await expect(runJqValueViaWorker('def f: f; f', null, 15)).rejects.toBeInstanceOf(
      JqTimeoutError,
    );
    expect(fake.terminated).toBe(true);
  });
});

describe('jq worker client — worker runtime error', () => {
  it('re-runs a pending request on the main thread when the worker errors', async () => {
    const fake = new FakeWorker();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fake.responder = () => {
      // The worker crashes instead of answering; the client must recover the
      // pending request on the main thread rather than hang the panel.
      queueMicrotask(() => {
        fake.emitError('worker crashed');
      });
    };
    setJqWorkerFactory(() => fake as unknown as Worker);
    const res = await runJqViaWorker('.a', '{"a":9}');
    expect(res.success).toBe(true);
    expect(res.output).toBe('main:.a:{"a":9}');
    expect(mainRunJq).toHaveBeenCalledWith('.a', '{"a":9}');
    warn.mockRestore();
  });
});
