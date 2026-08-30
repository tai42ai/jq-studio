/**
 * The worker shell's dispatch contract: a `runJq` message posts back the built
 * {@link JqResult}; a `runJqValue` message posts back the value, or the jq error
 * as `{ ok: false, error }` (the oracle needs the error told apart from a value).
 * jq-loader is mocked — this proves the message wiring, not the WASM runtime.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JqWorkerRequest, JqWorkerResponse } from './jq-worker-protocol';

const { runJq, runJqValue } = vi.hoisted(() => ({
  runJq: vi.fn(),
  runJqValue: vi.fn(),
}));
vi.mock('./jq-loader', () => ({ runJq, runJqValue }));

// The worker reads `postMessage` off the global scope; capture it.
const posted: JqWorkerResponse[] = [];
(globalThis as unknown as { postMessage: (m: JqWorkerResponse) => void }).postMessage = (m) => {
  posted.push(m);
};

// Importing the worker installs its `onmessage` handler on the global scope.
await import('./jq-eval.worker');

function getOnMessage(): (event: MessageEvent<JqWorkerRequest>) => void {
  const handler = (globalThis as unknown as { onmessage: unknown }).onmessage;
  return handler as (event: MessageEvent<JqWorkerRequest>) => void;
}

function dispatch(request: JqWorkerRequest): void {
  getOnMessage()({ data: request } as MessageEvent<JqWorkerRequest>);
}

afterEach(() => {
  posted.length = 0;
  runJq.mockReset();
  runJqValue.mockReset();
});

describe('jq-eval worker shell', () => {
  it('answers a runJq request with the built JqResult', async () => {
    const result = { success: true, output: '5', durationMs: 1 };
    runJq.mockResolvedValue(result);
    dispatch({ id: 7, kind: 'runJq', expression: '.a', jsonInput: '{"a":5}' });
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(runJq).toHaveBeenCalledWith('.a', '{"a":5}');
    expect(posted[0]).toEqual({ id: 7, kind: 'runJq', result });
  });

  it('answers a runJqValue request with the value', async () => {
    runJqValue.mockResolvedValue({ ok: 1 });
    dispatch({ id: 9, kind: 'runJqValue', program: '.', input: { ok: 1 } });
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ id: 9, kind: 'runJqValue', ok: true, value: { ok: 1 } });
  });

  it('reports a runJqValue jq error as { ok: false, error }', async () => {
    runJqValue.mockRejectedValue(new Error('jq: error'));
    dispatch({ id: 3, kind: 'runJqValue', program: '.(', input: null });
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ id: 3, kind: 'runJqValue', ok: false, error: 'jq: error' });
  });
});
