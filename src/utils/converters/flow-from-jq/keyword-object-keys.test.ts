// @vitest-environment node
/**
 * @fileoverview Object fields keyed by a jq keyword (`{end: .e}`, `{if: 1}`).
 *
 * jq accepts a keyword as an unquoted key, so the scanners that count `if … end`
 * as a nesting level must read one as a key rather than as a conditional opening
 * or closing — an `end` counted as a closing leaves the scan a level short and
 * hides every top-level operator after it.
 *
 * Each case reopens such an expression, regenerates it, and runs both texts
 * through the real jq WASM runtime, which rejects a text whose nesting came out
 * wrong.
 */

import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './index';
import { convertFlowToJQ } from '../jq-from-flow/index';
import { execJq } from '../test-helpers';

/**
 * Reopens `original`, expects `regenerated` back, and runs both texts through jq
 * expecting `expected` from `input`.
 */
async function expectRoundTrip(
  original: string,
  regenerated: string,
  input: unknown,
  expected: unknown,
): Promise<void> {
  const { nodes, edges } = convertJQToFlow(original);
  expect(convertFlowToJQ(nodes, edges)).toBe(regenerated);
  await expect(execJq(original, input)).resolves.toEqual(expected);
  await expect(execJq(regenerated, input)).resolves.toEqual(expected);
}

describe('Keyword-named object keys', () => {
  it('should find the pipe after an object with an `end` key', async () => {
    await expectRoundTrip(
      '{start: .s, end: .e} | tostring',
      '{"start": .s, "end": .e}\n| tostring',
      { s: 1, e: 2 },
      '{"start":1,"end":2}',
    );
  });

  it('should find the pipe after an object with an `if` key', async () => {
    await expectRoundTrip('{if: 1} | keys', '{"if": 1}\n| keys', null, ['if']);
  });

  it('should find the operator between two objects, one with an `end` key', async () => {
    await expectRoundTrip(
      '{end: .e} + {a: 1}',
      '({"end": .e} + {"a": 1})',
      { e: 2 },
      {
        end: 2,
        a: 1,
      },
    );
  });

  it('should find the pipe after an array holding an object with an `end` key', async () => {
    await expectRoundTrip('[{end: 1}] | length', '[{"end": 1}]\n| length', null, 1);
  });

  it('should keep the branches of a conditional whose branches build `end` objects', async () => {
    const original = 'if .c then {end: 1} else {end: 2} end';
    const regenerated = 'if .c then\n  {"end": 1}\nelse\n  {"end": 2}\nend';

    await expectRoundTrip(original, regenerated, { c: true }, { end: 1 });
    await expect(execJq(original, { c: false })).resolves.toEqual({ end: 2 });
    await expect(execJq(regenerated, { c: false })).resolves.toEqual({ end: 2 });
  });

  it('should find the catch after a try body building an `end` object', async () => {
    await expectRoundTrip('try {end: 1} catch .x', 'try {"end": 1} catch .x', null, { end: 1 });
  });

  it('should read a real conditional in the value of a keyword-keyed field', async () => {
    const original = '{end: (if .c then 1 else 2 end), then: .t}';

    const { nodes, edges } = convertJQToFlow(original);
    const regenerated = convertFlowToJQ(nodes, edges);

    await expect(execJq(original, { c: false, t: 'x' })).resolves.toEqual({ end: 2, then: 'x' });
    await expect(execJq(regenerated, { c: false, t: 'x' })).resolves.toEqual({ end: 2, then: 'x' });
    await expect(execJq(regenerated, { c: true, t: 'x' })).resolves.toEqual({ end: 1, then: 'x' });
  });

  it('should still read `end` as the closing of a conditional it opened', async () => {
    await expectRoundTrip(
      'if .c then 1 else 2 end | tostring',
      'if .c then\n  1\nelse\n  2\nend\n| tostring',
      { c: true },
      '1',
    );
  });

  it('should still read `.end` and `endswith` as a field and a function', async () => {
    await expectRoundTrip('.end | endswith("x")', '.end\n| endswith("x")', { end: 'ax' }, true);
  });
});

describe('Quoted equivalents of keyword-named object keys', () => {
  it('should find the pipe after a quoted `end` key', async () => {
    await expectRoundTrip(
      '{"start": .s, "end": .e} | tostring',
      '{"start": .s, "end": .e}\n| tostring',
      { s: 1, e: 2 },
      '{"start":1,"end":2}',
    );
  });

  it('should find the pipe after a quoted `if` key', async () => {
    await expectRoundTrip('{"if": 1} | keys', '{"if": 1}\n| keys', null, ['if']);
  });

  it('should find the operator between two objects, one with a quoted `end` key', async () => {
    await expectRoundTrip(
      '{"end": .e} + {"a": 1}',
      '({"end": .e} + {"a": 1})',
      { e: 2 },
      {
        end: 2,
        a: 1,
      },
    );
  });
});
