// @vitest-environment node
/**
 * @fileoverview Regression tests for the specific round-trip corruptions the
 * corpus gap-hunt surfaced. Each proven-corrupt expression is pinned here to
 * exactly one outcome:
 *   - a CLEANLY-FIXABLE shape now round-trips to behaviour-identical jq, or
 *   - a shape genuinely beyond the visual language now PARSE-FAILs honestly.
 *
 * Faithfulness is proven through the real jq WASM runtime, never by string match.
 */
import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './index';
import { convertFlowToJQ } from '../jq-from-flow';
import { compareJqSemantics } from '../faithfulness';
import { execJq } from '../test-helpers';

/** Round-trips an expression and asserts the result behaves identically to it. */
async function expectFaithful(expr: string): Promise<void> {
  const { nodes, edges } = convertJQToFlow(expr);
  const regenerated = convertFlowToJQ(nodes, edges);
  expect(await compareJqSemantics(expr, regenerated, execJq)).toBe('faithful');
}

describe('round-trip corruption fixes: cleanly-fixable pipe chains now stay faithful', () => {
  // Previously these dropped the trailing stage (e.g. `(.a | .b) | length`
  // serialised back to `.a | .b`, losing `length`) — a parenthesised sub-chain
  // surfacing as the LEFT of an outer pipe. The flattening converter now wires
  // every stage.
  it('(.a | .b) | length', () => expectFaithful('(.a | .b) | length'));
  it('(.a | .b) | .c', () => expectFaithful('(.a | .b) | .c'));
  it('(.a | .b | .c) | length', () => expectFaithful('(.a | .b | .c) | length'));

  // A parenthesised pipe of only simple terms IS a representable operator operand,
  // and must keep round-tripping (not be over-demoted by the operand guard).
  it('(.a | last | .b) // false', () => expectFaithful('(.a | last | .b) // false'));
});

describe('round-trip corruption fixes: unrepresentable shapes now PARSE-FAIL honestly', () => {
  // A pipe chain whose stages include an operator/array cannot fill an operator
  // operand faithfully — the serializer stranded its tail OUTSIDE the operator
  // (`((.a // {}) | .b) // []` → `((.a // {}) // []) | .b`). Refuse it.
  it('((.a // {}) | .b) // []', () => {
    expect(() => convertJQToFlow('((.a // {}) | .b) // []')).toThrow(/Unable to parse jq/);
  });

  // String interpolation has no Value-node form; drawing it kept `\(` as literal
  // text and rewrote the string.
  it('"hi \\(.name)"', () => {
    expect(() => convertJQToFlow('"hi \\(.name)"')).toThrow(/Unable to parse jq/);
  });

  // A computed/dynamic object key was drawn as a literal key string.
  it('{(.k): .v}', () => {
    expect(() => convertJQToFlow('{(.k): .v}')).toThrow(/Unable to parse jq/);
  });
});

describe('round-trip corruption fixes: representable constructs are NOT over-demoted', () => {
  // A plain escaped backslash before `(` is NOT interpolation and must still parse.
  it('"a \\\\ b" parses and stays faithful', () => expectFaithful('"a \\\\ b"'));
  // A quoted static key is representable and must still parse.
  it('{"k": .v} parses and stays faithful', () => expectFaithful('{"k": .v}'));
});
