// @vitest-environment node
/**
 * @fileoverview Unit tests for the faithfulness oracle — the semantic judge that
 * decides whether two jq programs behave identically. Driven by the real jq WASM
 * runtime (via `execJq`), so the comparison is proven against actual jq.
 */
import { describe, expect, it } from 'vitest';

import { compareJqSemantics, FAITHFULNESS_SAMPLE_INPUTS } from './faithfulness';
import { execJq } from './test-helpers';

describe('faithfulness oracle: compareJqSemantics', () => {
  it('calls a reformat that behaves the same FAITHFUL', async () => {
    // Extra parentheses and spacing do not change behaviour.
    expect(await compareJqSemantics('.a + .b', '( .a + .b )', execJq)).toBe('faithful');
    expect(await compareJqSemantics('.a // .b // .c', '(.a // (.b // .c))', execJq)).toBe(
      'faithful',
    );
  });

  it('calls a rewrite that changes behaviour UNFAITHFUL', async () => {
    // Re-associating `|` past a stage changes what the program computes.
    expect(await compareJqSemantics('(.a | .b) | length', '.a | .b', execJq)).toBe('unfaithful');
  });

  it('treats two programs that ERROR identically as faithful', async () => {
    // `error` fails on every input; both sides fail the same way.
    expect(await compareJqSemantics('error("x")', 'error("x")', execJq)).toBe('faithful');
  });

  it('treats one erroring and one succeeding program as unfaithful', async () => {
    expect(await compareJqSemantics('error("x")', '"x"', execJq)).toBe('unfaithful');
  });

  it('disambiguates a multi-output stream from a single array output', async () => {
    // `.[]` streams the elements; `[…]` yields one array. jq collapses a stream
    // ambiguously, so a text-blind check would miss this — the oracle must not.
    expect(await compareJqSemantics('.[]', '[.[]]', execJq)).toBe('unfaithful');
  });

  it('bounds an unbounded generator instead of hanging', async () => {
    // `recurse(.)` streams forever on a non-null input; the oracle's `limit`
    // wrapper keeps the comparison finite and fast.
    const verdict = await compareJqSemantics('recurse(.)', 'recurse(.)', execJq, [], [{ a: 1 }]);
    expect(verdict).toBe('faithful');
  });

  it('exposes a frozen sample battery spanning the JSON value space', () => {
    expect(Object.isFrozen(FAITHFULNESS_SAMPLE_INPUTS)).toBe(true);
    expect(FAITHFULNESS_SAMPLE_INPUTS).toContain(null);
    expect(FAITHFULNESS_SAMPLE_INPUTS.some((v) => Array.isArray(v))).toBe(true);
    expect(
      FAITHFULNESS_SAMPLE_INPUTS.some(
        (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
      ),
    ).toBe(true);
  });
});

describe('faithfulness oracle: declared variables', () => {
  it('binds a declared variable in both texts so a wrong regeneration is UNFAITHFUL', async () => {
    // `$account` is bound to each sample, so the two texts diverge on a sample
    // carrying the read field — where unbound both would compile-error alike.
    expect(
      await compareJqSemantics(
        '$account.tier',
        '$account.tie',
        execJq,
        ['account'],
        [{ tier: 'gold' }],
      ),
    ).toBe('unfaithful');
  });

  it('calls a behaviour-identical variable round-trip FAITHFUL', async () => {
    expect(
      await compareJqSemantics(
        '$account.tier',
        '$account | .tier',
        execJq,
        ['account'],
        [{ tier: 'gold' }],
      ),
    ).toBe('faithful');
  });

  it('exercises a variable read inside map(...), where `.` is rebound to the item', async () => {
    // `$n` is reachable inside `map(...)`; a commutative reformat stays faithful,
    // an operator change is caught.
    expect(
      await compareJqSemantics(
        'map(. + ($n | length))',
        'map(($n | length) + .)',
        execJq,
        ['n'],
        [[1, 2, 3]],
      ),
    ).toBe('faithful');
    expect(
      await compareJqSemantics(
        'map(. + ($n | length))',
        'map(. - ($n | length))',
        execJq,
        ['n'],
        [[1, 2, 3]],
      ),
    ).toBe('unfaithful');
  });

  it('leaves the verdict unchanged when no variables are declared', async () => {
    expect(await compareJqSemantics('.a + .b', '(.a + .b)', execJq, [])).toBe('faithful');
    expect(await compareJqSemantics('.a', '.b', execJq, [])).toBe('unfaithful');
  });

  it('rejects with the binder’s error for a reserved declared name, never a verdict', async () => {
    await expect(compareJqSemantics('$__in', '$__in', execJq, ['__in'])).rejects.toThrow(
      /reserved/,
    );
  });

  it('rejects with the binder’s error for a malformed declared name, never a verdict', async () => {
    await expect(compareJqSemantics('.', '.', execJq, ['not a name'])).rejects.toThrow(
      /valid jq variable/,
    );
  });
});
