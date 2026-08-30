// @vitest-environment node
/**
 * Unit tests for jq-studio's public guard API (`canRepresentFaithfully`,
 * `roundTripVerdict`, `checkJqValidity`).
 *
 * The app's own `jq-loader` resolves `jq.wasm` relative to the browser bundle,
 * which is not present in the node test host — so, exactly as the guard's own
 * unit test does, route the runtime at the disk-loaded WASM (`execJq`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./utils/jq-loader', async (importActual) => {
  const actual = await importActual<typeof import('./utils/jq-loader')>();
  const { execJq } = await import('./utils/converters/test-helpers');
  return {
    ...actual,
    runJqValue: (program: string, input: unknown) => execJq(program, input),
    checkJqValidity: async (expression: string): Promise<'valid' | 'invalid'> => {
      if (!expression.trim()) return 'valid';
      try {
        await execJq(expression, null);
        return 'valid';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return /compile error|syntax error/i.test(message) ? 'invalid' : 'valid';
      }
    },
  };
});

import {
  canRepresentFaithfully,
  checkJqValidity,
  roundTripVerdict,
  clearRoundTripVerdictCache,
} from './guard';

describe('jq-studio guard API', () => {
  beforeEach(() => {
    clearRoundTripVerdictCache();
  });

  it('reports a simple path expression as faithfully representable', async () => {
    expect(await canRepresentFaithfully('.foo')).toBe(true);
    expect(await roundTripVerdict('.foo')).toBe('faithful');
  });

  it('treats empty input as faithful (nothing to corrupt)', async () => {
    expect(await roundTripVerdict('')).toBe('faithful');
    expect(await canRepresentFaithfully('   ')).toBe(true);
  });

  it('memoises the verdict per expression and clears on request', async () => {
    const first = await roundTripVerdict('.a.b');
    const second = await roundTripVerdict('.a.b');
    expect(first).toBe(second);
    clearRoundTripVerdictCache();
    expect(await roundTripVerdict('.a.b')).toBe(first);
  });

  it('compile-checks jq validity independent of faithfulness', async () => {
    expect(await checkJqValidity('.foo')).toBe('valid');
    expect(await checkJqValidity('')).toBe('valid');
    expect(await checkJqValidity('.a == 1')).toBe('valid');
    // A malformed program fails jq's compiler.
    expect(await checkJqValidity('.foo |')).toBe('invalid');
  });
});
