// @vitest-environment node
/**
 * @fileoverview Unit tests for the runtime faithfulness GUARD.
 *
 * The guard is what makes silent corruption structurally impossible: it serialises
 * a parsed graph back and asks the oracle whether the two texts behave the same,
 * BEFORE the graph is ever shown for editing. These tests drive the real oracle
 * over the real jq WASM (routed through `execJq`, which loads the runtime from
 * disk), and prove the guard falls back the moment the round-trip drifts — even
 * when the drift is injected by a deliberately-corrupting serializer mock, i.e.
 * a stand-in for any future parser/serializer bug.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Route the guard's executor at the disk-loaded WASM runtime (the app's own
// `runJqValue` resolves `jq.wasm` relative to the browser bundle, which is not
// present in the node test host).
vi.mock('../jq-loader', async () => {
  const { execJq } = await import('./test-helpers');
  return { runJqValue: (program: string, input: unknown) => execJq(program, input) };
});

// A controllable serialize step, so a test can inject a corrupting round-trip
// without a real parser bug. Defaults to the genuine serializer.
const { convertFlowToJQMock } = vi.hoisted(() => ({ convertFlowToJQMock: vi.fn() }));
vi.mock('./jq-from-flow', async (importActual) => {
  const actual = await importActual<typeof import('./jq-from-flow')>();
  convertFlowToJQMock.mockImplementation(actual.convertFlowToJQ);
  return { ...actual, convertFlowToJQ: convertFlowToJQMock };
});

import { roundTripVerdict, clearRoundTripVerdictCache } from './faithfulness-guard';

beforeEach(async () => {
  clearRoundTripVerdictCache();
  // Reset the serializer to the genuine one before each test (a corrupting test
  // overrides it per-case).
  const actual = await vi.importActual<typeof import('./jq-from-flow')>('./jq-from-flow');
  convertFlowToJQMock.mockReset();
  convertFlowToJQMock.mockImplementation(actual.convertFlowToJQ);
});

describe('faithfulness guard: roundTripVerdict', () => {
  it('reports a faithful round-trip as faithful', async () => {
    expect(await roundTripVerdict('.a.b.c')).toBe('faithful');
  });

  it('reports an expression the converter cannot parse as unparseable', async () => {
    // Unbalanced parens: no graph is built, so there is no save-over-text path.
    expect(await roundTripVerdict('((')).toBe('unparseable');
  });

  it('treats an empty expression as faithful (nothing to corrupt)', async () => {
    expect(await roundTripVerdict('   ')).toBe('faithful');
  });

  it('FALLS BACK to unfaithful when the serializer produces different-behaving jq', async () => {
    // Stand-in for any remaining parser/serializer bug: the graph for `.a`
    // serialises to `.b`, which behaves differently. The guard must catch it
    // through the oracle regardless of WHY the drift happened.
    convertFlowToJQMock.mockReturnValue('.b');
    expect(await roundTripVerdict('.a')).toBe('unfaithful');
  });

  it('memoises the verdict per expression', async () => {
    // A constant differs from the path `.memoed` on every input (null vs "X").
    convertFlowToJQMock.mockReturnValue('"X"');
    expect(await roundTripVerdict('.memoed')).toBe('unfaithful');
    convertFlowToJQMock.mockClear();
    // Second call for the same text must not re-run the serializer/oracle.
    expect(await roundTripVerdict('.memoed')).toBe('unfaithful');
    expect(convertFlowToJQMock).not.toHaveBeenCalled();
  });
});
