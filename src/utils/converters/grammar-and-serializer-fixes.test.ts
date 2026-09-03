// @vitest-environment node
/**
 * @fileoverview Regression tests for converter fixes proven against the real
 * converters and judged by the jq WASM faithfulness oracle:
 *
 *   - the serializer losing operands when a 3+-operand boolean chain of
 *     operator sub-expressions sits under a comparison parent,
 *   - postfix paths on variable references (`$a.field`, `$a["key"]`),
 *   - a parenthesised pipeline as a postfix-path target (`(.a | .b).c`),
 *     accepted only for input-free postfixes and refused otherwise.
 */
import { describe, it, expect } from 'vitest';
import { convertJQToFlow } from './flow-from-jq';
import { convertFlowToJQ } from '../converters/jq-from-flow';
import { compareJqSemantics } from './faithfulness';
import { execJq } from './test-helpers';
import { JQNodeType, ValueType } from '../../enums';
import type { JQValueData } from '../../types';

/** Round-trips an expression and asserts the result behaves identically to it. */
async function expectFaithful(expr: string): Promise<string> {
  const { nodes, edges } = convertJQToFlow(expr);
  const regenerated = convertFlowToJQ(nodes, edges);
  expect(await compareJqSemantics(expr, regenerated, execJq)).toBe('faithful');
  return regenerated;
}

describe('operator chains under a comparison parent keep every operand', () => {
  // The outermost-operator search read nesting off shared operand sources only;
  // an operator whose operands are themselves operator chains carries no edge
  // from any node also feeding the outer operators, so it counted as an
  // outermost candidate and the serializer emitted just its subtree —
  // `((.a // false) or (.b // false) or (.c // false)) == false` regenerated as
  // `((.b // false) or (.c // false))`.
  it('2-operand chain under ==', () => expectFaithful('((.a // false) or (.b // false)) == false'));
  it('3-operand chain under ==', () =>
    expectFaithful('((.a // false) or (.b // false) or (.c // false)) == false'));
  it('4-operand chain under ==', () =>
    expectFaithful('((.a // false) or (.b // false) or (.c // false) or (.d // false)) == false'));
  it('mixed-operand chain under ==', () =>
    expectFaithful('((.a // false) or (.b // false) or .c) == false'));

  it('bare 2-operand chain', () => expectFaithful('(.a // false) or (.b // false)'));
  it('bare 3-operand chain', () =>
    expectFaithful('(.a // false) or (.b // false) or (.c // false)'));
  it('bare 4-operand chain', () =>
    expectFaithful('(.a // false) or (.b // false) or (.c // false) or (.d // false)'));

  it('3-operand and-chain under ==', () =>
    expectFaithful('((.a // 1) and (.b // 2) and (.c // 3)) == true'));
});

describe('postfix paths compose onto variable references', () => {
  it('$var.field round-trips to the postfix form', async () => {
    const out = await expectFaithful('.x as $a | $a.field');
    expect(out).toContain('$a.field');
  });

  it('$var["key"] round-trips to the postfix form', async () => {
    const out = await expectFaithful('.x as $a | $a["key"]');
    expect(out).toContain('$a["key"]');
  });

  it('$var["a:b"].field round-trips to the postfix form', async () => {
    const out = await expectFaithful('.x as $a | $a["a:b"].field');
    expect(out).toContain('$a["a:b"].field');
  });

  it('chained segments round-trip to the postfix form', async () => {
    const out = await expectFaithful('.x as $a | $a.items[0].name');
    expect(out).toContain('$a.items[0].name');
  });

  it('reference in an operator operand round-trips', () =>
    expectFaithful('. as $a | .b as $c | $a.b == $c'));

  it('draws the same node shapes as a dot path: node_ref root plus path segments', () => {
    const { nodes } = convertJQToFlow('.x as $a | $a.items[0]');
    const refNode = nodes.find(
      (n) =>
        n.data.type === JQNodeType.Value && (n.data as JQValueData).pathValue === '$a.items[0]',
    );
    expect(refNode).toBeDefined();
    const data = refNode?.data as JQValueData;
    expect(data.valueType).toBe(ValueType.Path);
    expect(data.pathSegments).toEqual([
      { id: 'seg_0', type: 'node_ref', value: 'a' },
      { id: 'seg_1', type: 'field', value: 'items' },
      { id: 'seg_2', type: 'index', value: '0' },
    ]);
  });

  it('a postfix reference still creates a real stage after `as` (no echo elision)', async () => {
    const out = await expectFaithful('.x as $a | $a.field');
    expect(out).toContain('as $a');
    expect(out).toContain('$a.field');
  });

  it('an undefined variable is named without its postfix path', () => {
    expect(() => convertJQToFlow('$missing.field')).toThrow(
      'Reference to undefined variable: $missing',
    );
  });
});

describe('parenthesised pipeline as a postfix-path target lowers to a pipe', () => {
  // The node graph has no group node, so `(P).b` is drawn as the pipe it means:
  // `P | .b`. The lowering is applied only to postfixes that read nothing from
  // the input (literal fields/keys/indexes/ranges, `[]`, `$vars`) — those are
  // behaviour-identical under the pipe rewrite, which the oracle proves here.
  it('(.a).b', () => expectFaithful('(.a).b'));
  it('(.a | .b).c', () => expectFaithful('(.a | .b).c'));
  it('(.a)["k"]', () => expectFaithful('(.a)["k"]'));
  it('(.a // {})["identity"]', () => expectFaithful('(.a // {})["identity"]'));
  it('(.items)[0]', () => expectFaithful('(.items)[0]'));
  it('(.items)[]', () => expectFaithful('(.items)[]'));
  it('(.items)[1:3]', () => expectFaithful('(.items)[1:3]'));
  it('chained postfix segments', () => expectFaithful('(.a).b.c["k"]'));
  it('conditional group target', () => expectFaithful('(if .a then .b else .c end).x'));
  it('variable index postfix', () => expectFaithful('.k as $k | (.a)[$k]'));

  // A computed index reads the ORIGINAL input (`.b` in `(.a)[.b]` indexes with
  // the input's `.b`, not `.a.b`), which the pipe rewrite cannot reproduce —
  // the honest parse-fail stays.
  it('computed index postfix parse-fails', () => {
    expect(() => convertJQToFlow('(.a)[.b]')).toThrow(/Unable to parse jq/);
  });

  // The lowered group is still subject to the operator-operand guard: a group
  // whose pipe carries an operator stage has no faithful graph as an operand.
  it('computed-group postfix as operator operand still parse-fails', () => {
    expect(() => convertJQToFlow('((.a // {})["identity"] // []) | length')).toThrow(
      /Unable to parse jq/,
    );
  });
});

describe('assignment values the name cannot bind whole are refused', () => {
  // `EXPR as $var` is drawn by naming EXPR's entry node. When EXPR is an
  // operator whose leftmost operand is a multi-stage pipe, the name lands
  // MID-operand and splits it — `((.p | type) == "x") as $v` came back as
  // `(.p == "x") as $v … | type`, rebinding $v to a fragment. Refused honestly.
  it('operator value with a pipe on the entry spine parse-fails', () => {
    expect(() => convertJQToFlow('((.p | type) == "object") as $isobj | $isobj')).toThrow(
      /Unable to parse jq/,
    );
  });

  it('nested operator spine with a pipe parse-fails', () => {
    expect(() => convertJQToFlow('(((.a | length) > 2) and .b) as $v | $v')).toThrow(
      /Unable to parse jq/,
    );
  });

  // Shapes the name CAN bind whole keep round-tripping.
  it('simple operator value stays accepted', () => expectFaithful('(.a == 1) as $v | $v'));
  it('operator value with single-term operands stays accepted', () =>
    expectFaithful('(.a // false) as $v | $v'));
  it('echoed pipe value stays accepted', () => expectFaithful('(.a | .b) as $x | $x'));
});

describe('a quoted key classifies as an index segment, never a range', () => {
  // A colon inside the quotes is part of the key: the range read kept the text
  // round-trip intact by accident but surfaced the segment in the editor as a
  // range picker instead of a string-key field.
  function pathSegmentsOf(expr: string, pathValue: string) {
    const { nodes } = convertJQToFlow(expr);
    const node = nodes.find(
      (n) => n.data.type === JQNodeType.Value && (n.data as JQValueData).pathValue === pathValue,
    );
    expect(node).toBeDefined();
    return (node?.data as JQValueData).pathSegments;
  }

  it('["a:b"] is an index segment', () => {
    expect(pathSegmentsOf('.x["a:b"]', '.x["a:b"]')).toEqual([
      { id: 'seg_0', type: 'root', value: '.' },
      { id: 'seg_1', type: 'field', value: 'x' },
      { id: 'seg_2', type: 'index', value: '"a:b"' },
    ]);
  });

  it('a real range [1:3] still classifies as a range segment', () => {
    expect(pathSegmentsOf('.x[1:3]', '.x[1:3]')).toEqual([
      { id: 'seg_0', type: 'root', value: '.' },
      { id: 'seg_1', type: 'field', value: 'x' },
      { id: 'seg_2', type: 'range', value: '1', rangeEnd: '3' },
    ]);
  });

  it('["a:b"] still round-trips verbatim', async () => {
    const out = await expectFaithful('.x["a:b"].y');
    expect(out).toBe('.x["a:b"].y');
  });
});
