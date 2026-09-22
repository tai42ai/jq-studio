// @vitest-environment node
/**
 * Unit tests for jq-studio's public guard API (`canRepresentFaithfully`,
 * `roundTripVerdict`, `checkJqValidity`).
 *
 * The app's own `jq-loader` resolves `jq.wasm` relative to the browser bundle,
 * which is not present in the node test host — so, exactly as the guard's own
 * unit test does, route the runtime at the disk-loaded WASM (`execJq`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./utils/jq-loader', async (importActual) => {
  const actual = await importActual<typeof import('./utils/jq-loader')>();
  const { execJq } = await import('./utils/converters/test-helpers');
  const { bindJqVariables } = await import('./utils/jq-variable-binding');
  return {
    ...actual,
    runJqValue: (program: string, input: unknown) => execJq(program, input),
    checkJqValidity: async (
      expression: string,
      declaredVariables: readonly string[] = [],
    ): Promise<'valid' | 'invalid'> => {
      if (!expression.trim()) return 'valid';
      const { program, input } = bindJqVariables(
        expression,
        'null',
        Object.fromEntries(declaredVariables.map((name) => [name, null])),
      );
      try {
        await execJq(program, JSON.parse(input));
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
  clearRoundTripVerdictCache,
  roundTripVerdict,
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

  it('judges a declared-variable expression faithful through the oracle, variables bound', async () => {
    expect(await roundTripVerdict('$account.tier', ['account'])).toBe('faithful');
    expect(await canRepresentFaithfully('map(. + $offset)', ['offset'])).toBe(true);
  });

  it('compile-checks jq validity independent of faithfulness', async () => {
    expect(await checkJqValidity('.foo')).toBe('valid');
    expect(await checkJqValidity('')).toBe('valid');
    expect(await checkJqValidity('.a == 1')).toBe('valid');
    // A malformed program fails jq's compiler.
    expect(await checkJqValidity('.foo |')).toBe('invalid');
  });

  it('compiles a declared-variable reference as valid only when the name is declared', async () => {
    const expression = '$account | reduce .[] as $x (0; . + $x)';
    expect(await checkJqValidity(expression, ['account'])).toBe('valid');
    // Undeclared, jq rejects the `$account` reference as a compile error.
    expect(await checkJqValidity(expression)).toBe('invalid');
  });
});
